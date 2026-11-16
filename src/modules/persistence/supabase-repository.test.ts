import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { buildSession } from "@/modules/sessions/models";
import { getTarget } from "@/modules/targets/catalogue";
import { NotFoundError, ValidationError } from "./repository";
import { EYEPIECE_ACCESSORY, PROFILE, runRepositoryContract, SPEC } from "./repository.contract";
import { AuthRequiredError, createSupabaseRepository } from "./supabase-repository";

/**
 * Integration tests against a running Supabase instance (`pnpm test:db`
 * starts from `supabase status`). Skipped when no instance is configured.
 * Every test signs up a brand-new user, so tests never share data.
 */

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_KEY;
const enabled = Boolean(url && key);

function anonClient() {
  return createClient<Database>(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function userClient() {
  const client = anonClient();
  const { data, error } = await client.auth.signUp({
    email: `test-${crypto.randomUUID()}@example.com`,
    password: "correct-horse-battery-staple",
  });
  if (error || !data.user) throw error ?? new Error("sign-up failed");
  return { client, userId: data.user.id };
}

describe.skipIf(!enabled)("supabase", () => {
  runRepositoryContract("supabase", async () => createSupabaseRepository((await userClient()).client));

  describe("security: data is private to its owner", () => {
    let alice: Awaited<ReturnType<typeof userClient>>;
    let bob: Awaited<ReturnType<typeof userClient>>;
    beforeAll(async () => {
      alice = await userClient();
      bob = await userClient();
    });

    it("another user cannot read, change or delete a profile", async () => {
      const a = createSupabaseRepository(alice.client);
      const b = createSupabaseRepository(bob.client);
      const p = await a.createProfile(PROFILE);

      expect(await b.getProfile(p.id)).toBeUndefined();
      expect((await b.listProfiles()).map((x) => x.id)).not.toContain(p.id);
      await expect(b.updateProfile(p.id, { ...PROFILE, name: "Stolen" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(b.deleteProfile(p.id)).rejects.toBeInstanceOf(NotFoundError);
      expect((await a.getProfile(p.id))?.name).toBe(PROFILE.name);
    });

    it("another user cannot link a configuration to someone else's profile", async () => {
      const p = await createSupabaseRepository(alice.client).createProfile(PROFILE);
      await expect(
        createSupabaseRepository(bob.client).createConfiguration({ ...SPEC, profileId: p.id }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("another user cannot read, update, duplicate or delete a configuration", async () => {
      const c = await createSupabaseRepository(alice.client).createConfiguration(SPEC);
      const b = createSupabaseRepository(bob.client);
      expect(await b.getConfiguration(c.id)).toBeUndefined();
      await expect(b.updateConfiguration(c.id, SPEC)).rejects.toBeInstanceOf(NotFoundError);
      await expect(b.duplicateConfiguration(c.id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(b.deleteConfiguration(c.id)).rejects.toBeInstanceOf(NotFoundError);

      // Direct component writes into someone else's configuration are refused.
      const { error } = await bob.client
        .from("configuration_components")
        .insert({ configuration_id: c.id, component_type: "barlow", spec: { factor: 2 } });
      expect(error?.code).toBe("42501");
    });

    it("another user cannot read or delete a session", async () => {
      const s = await createSupabaseRepository(alice.client).createSession(
        buildSession({
          configuration: SPEC,
          target: getTarget("moon")!,
          mode: "eyepiece",
          conditions: {},
          view: { focusOffset: 0, longExposureColor: false, zoom: 1 },
        }),
      );
      const b = createSupabaseRepository(bob.client);
      expect(await b.getSession(s.id)).toBeUndefined();
      await expect(b.deleteSession(s.id)).rejects.toBeInstanceOf(NotFoundError);
      const { data } = await bob.client.from("simulation_results").select("session_id").eq("session_id", s.id);
      expect(data).toEqual([]);
    });

    it("another user cannot read, change or delete an accessory", async () => {
      const a = await createSupabaseRepository(alice.client).createAccessory(EYEPIECE_ACCESSORY);
      const b = createSupabaseRepository(bob.client);
      expect((await b.listAccessories()).map((x) => x.id)).not.toContain(a.id);
      await expect(b.updateAccessory(a.id, { ...EYEPIECE_ACCESSORY, name: "Stolen" })).rejects.toBeInstanceOf(NotFoundError);
      await expect(b.deleteAccessory(a.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("another user cannot see projects or link sessions across accounts", async () => {
      const aRepo = createSupabaseRepository(alice.client);
      const bRepo = createSupabaseRepository(bob.client);
      const view = { focusOffset: 0, longExposureColor: false, zoom: 1 };
      const aliceProject = await aRepo.createProject({ name: "Alice", targetIds: [] });
      const aliceSession = await aRepo.createSession(
        buildSession({ configuration: SPEC, target: getTarget("moon")!, mode: "eyepiece", conditions: {}, view }),
      );
      const bobProject = await bRepo.createProject({ name: "Bob", targetIds: [] });
      const bobSession = await bRepo.createSession(
        buildSession({ configuration: SPEC, target: getTarget("moon")!, mode: "eyepiece", conditions: {}, view }),
      );

      expect(await bRepo.getProject(aliceProject.id)).toBeUndefined();
      await expect(bRepo.updateProject(aliceProject.id, { name: "x", targetIds: [] })).rejects.toBeInstanceOf(NotFoundError);
      await expect(bRepo.deleteProject(aliceProject.id)).rejects.toBeInstanceOf(NotFoundError);
      // Bob cannot put Alice's session in his project, nor his session in hers.
      await expect(bRepo.addSessionToProject(bobProject.id, aliceSession.id)).rejects.toBeInstanceOf(NotFoundError);
      await expect(bRepo.addSessionToProject(aliceProject.id, bobSession.id)).rejects.toBeInstanceOf(NotFoundError);
      const direct = await bob.client.from("project_sessions").insert({ project_id: bobProject.id, session_id: aliceSession.id });
      expect(direct.error?.code).toBe("42501");
    });

    it("rows cannot be created on behalf of another user", async () => {
      const { error } = await alice.client.from("telescope_profiles").insert({
        owner_id: bob.userId,
        name: "Spoofed",
        optical_design: "refractor",
        aperture_mm: 80,
        focal_length_mm: 480,
        mount_type: "equatorial",
      });
      expect(error?.code).toBe("42501");
    });

    it("signed-out visitors cannot read or write anything", async () => {
      const anon = createSupabaseRepository(anonClient());
      await expect(anon.listProfiles()).rejects.toBeInstanceOf(AuthRequiredError);
      await expect(anon.createProfile(PROFILE)).rejects.toBeInstanceOf(AuthRequiredError);
      await expect(anon.createConfiguration(SPEC)).rejects.toBeInstanceOf(AuthRequiredError);
      await expect(anon.listAccessories()).rejects.toBeInstanceOf(AuthRequiredError);
      await expect(anon.listProjects()).rejects.toBeInstanceOf(AuthRequiredError);
    });
  });

  describe("integrity enforced by the database itself", () => {
    it("saved sessions cannot be modified", async () => {
      const { client } = await userClient();
      const s = await createSupabaseRepository(client).createSession(
        buildSession({
          configuration: SPEC,
          target: getTarget("saturn")!,
          mode: "eyepiece",
          conditions: {},
          view: { focusOffset: 0, longExposureColor: false, zoom: 1 },
        }),
      );
      const sessionUpdate = await client.from("simulation_sessions").update({ name: "Rewritten" }).eq("id", s.id);
      expect(sessionUpdate.error?.code).toBe("42501");
      const snapshotUpdate = await client
        .from("session_configurations")
        .update({ snapshot: { name: "Rewritten" } })
        .eq("session_id", s.id);
      expect(snapshotUpdate.error?.code).toBe("42501");
    });

    it("rejects out-of-range values written directly, bypassing the app", async () => {
      const { client } = await userClient();
      const c = await createSupabaseRepository(client).createConfiguration(SPEC);

      const badProfile = await client.from("telescope_profiles").insert({
        name: "Bad",
        optical_design: "refractor",
        aperture_mm: 0,
        focal_length_mm: 480,
        mount_type: "equatorial",
      });
      expect(badProfile.error?.code).toBe("23514");

      const badComponent = await client
        .from("configuration_components")
        .insert({ configuration_id: c.id, component_type: "camera", spec: { sensorWidthMm: "wide" } });
      expect(badComponent.error?.code).toBe("23514");

      const badAccessory = await client
        .from("accessories")
        .insert({ kind: "mount", name: "Bad", status: "owned", spec: { type: "tripod" } });
      expect(badAccessory.error?.code).toBe("23514");
    });

    it("direct edits still bump the configuration version", async () => {
      const { client } = await userClient();
      const repo = createSupabaseRepository(client);
      const c = await repo.createConfiguration(SPEC);
      const { error } = await client.from("telescope_configurations").update({ status: "planned", version: 1 }).eq("id", c.id);
      expect(error).toBeNull();
      expect((await repo.getConfiguration(c.id))?.version).toBe(2);
    });
  });
});
