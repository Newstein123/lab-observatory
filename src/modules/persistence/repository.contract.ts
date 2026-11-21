import { beforeEach, describe, expect, it } from "vitest";
import type { ConfigurationSpec } from "@/modules/configurations/models";
import type { AccessoryInput, TelescopeProfileInput } from "@/modules/equipment/models";
import { buildSession, checkReproduction } from "@/modules/sessions/models";
import { getTarget } from "@/modules/targets/catalogue";
import { NotFoundError, ValidationError, type ObservatoryRepository } from "./repository";

/**
 * Behaviour every ObservatoryRepository implementation must satisfy.
 * Each test receives a fresh, empty repository for a single user.
 */

export const PROFILE: TelescopeProfileInput = {
  name: "My 200 mm Newtonian",
  status: "owned",
  opticalDesign: "reflector",
  apertureMm: 200,
  focalLengthMm: 1000,
  mountType: "dobsonian",
};

export const SPEC: ConfigurationSpec = {
  name: "Planetary",
  status: "owned",
  telescope: { apertureMm: 200, focalLengthMm: 1000, opticalDesign: "reflector" },
  eyepiece: { focalLengthMm: 25, apparentFovDeg: 50 },
};

export const EYEPIECE_ACCESSORY: AccessoryInput = {
  kind: "eyepiece",
  name: "Panoptic 24",
  status: "owned",
  manufacturer: "Tele Vue",
  model: "Panoptic 24 mm",
  spec: { focalLengthMm: 24, apparentFovDeg: 68, barrelIn: 1.25, eyeReliefMm: 15, fieldStopMm: 27 },
};

const MISSING_ID = "00000000-0000-4000-8000-000000000000";
const view = { focusOffset: 0, longExposureColor: false, zoom: 1 };

export function runRepositoryContract(name: string, makeRepository: () => Promise<ObservatoryRepository>) {
  describe(`${name}: repository contract`, () => {
    let repo: ObservatoryRepository;
    beforeEach(async () => {
      repo = await makeRepository();
    });

    describe("equipment profiles (AC-01)", () => {
      it("creates, lists, updates and deletes a profile", async () => {
        const p = await repo.createProfile(PROFILE);
        expect(p).toMatchObject(PROFILE);
        expect(await repo.listProfiles()).toHaveLength(1);
        expect(await repo.getProfile(p.id)).toEqual(p);

        const u = await repo.updateProfile(p.id, { ...PROFILE, name: "Renamed" });
        expect(u.name).toBe("Renamed");
        expect(u.createdAt).toBe(p.createdAt);
        expect(u.updatedAt >= p.updatedAt).toBe(true);

        await repo.deleteProfile(p.id);
        expect(await repo.listProfiles()).toEqual([]);
      });

      it("stores status and identification metadata", async () => {
        const input: TelescopeProfileInput = {
          ...PROFILE,
          status: "planned",
          manufacturer: "Sky-Watcher",
          model: "Skyliner 200P",
          notes: "Wish list",
        };
        const p = await repo.createProfile(input);
        expect(await repo.getProfile(p.id)).toMatchObject(input);
        await expect(repo.createProfile({ ...PROFILE, status: "borrowed" as never })).rejects.toBeInstanceOf(ValidationError);
      });

      it("rejects invalid profiles", async () => {
        await expect(repo.createProfile({ ...PROFILE, apertureMm: 0 })).rejects.toBeInstanceOf(ValidationError);
        await expect(repo.createProfile({ ...PROFILE, name: "  " })).rejects.toBeInstanceOf(ValidationError);
      });

      it("reports unknown ids", async () => {
        await expect(repo.updateProfile(MISSING_ID, PROFILE)).rejects.toBeInstanceOf(NotFoundError);
        await expect(repo.deleteProfile(MISSING_ID)).rejects.toBeInstanceOf(NotFoundError);
        expect(await repo.getProfile(MISSING_ID)).toBeUndefined();
        expect(await repo.getProfile("not-a-uuid")).toBeUndefined();
      });
    });

    describe("accessories", () => {
      it("creates, lists, updates and deletes accessories of every kind", async () => {
        const a = await repo.createAccessory(EYEPIECE_ACCESSORY);
        expect(a).toMatchObject(EYEPIECE_ACCESSORY);
        const others: AccessoryInput[] = [
          { kind: "camera", name: "Imaging cam", status: "planned", spec: { sensorWidthMm: 11.31, sensorHeightMm: 11.31, pixelSizeUm: 3.76, color: true } },
          { kind: "barlow", name: "2x", status: "owned", spec: { factor: 2, barrelIn: 1.25 } },
          { kind: "filter", name: "UHC", status: "experimental", spec: { name: "UHC", kind: "uhc" } },
          { kind: "mount", name: "EQ5", status: "owned", spec: { type: "equatorial", payloadKg: 9, goto: false, tracking: true } },
        ];
        for (const o of others) expect(await repo.createAccessory(o)).toMatchObject(o);
        expect(await repo.listAccessories()).toHaveLength(5);

        const u = await repo.updateAccessory(a.id, { ...EYEPIECE_ACCESSORY, status: "experimental" });
        expect(u.status).toBe("experimental");
        expect(u.createdAt).toBe(a.createdAt);

        await repo.deleteAccessory(a.id);
        expect(await repo.listAccessories()).toHaveLength(4);
        await expect(repo.deleteAccessory(a.id)).rejects.toBeInstanceOf(NotFoundError);
        await expect(repo.updateAccessory(MISSING_ID, EYEPIECE_ACCESSORY)).rejects.toBeInstanceOf(NotFoundError);
      });

      it("rejects invalid accessories", async () => {
        await expect(
          repo.createAccessory({ kind: "eyepiece", name: "Bad", status: "owned", spec: { focalLengthMm: 0, apparentFovDeg: 50 } }),
        ).rejects.toBeInstanceOf(ValidationError);
        await expect(
          repo.createAccessory({ kind: "mount", name: "x", status: "owned", spec: { type: "tripod" as never } }),
        ).rejects.toBeInstanceOf(ValidationError);
      });
    });

    describe("configurations (AC-02, AC-03, AC-04)", () => {
      it("creates a hypothetical configuration without a profile", async () => {
        const c = await repo.createConfiguration(SPEC);
        expect(c.profileId).toBeUndefined();
        expect(c.version).toBe(1);
        expect(c.eyepiece).toEqual(SPEC.eyepiece);
        expect(await repo.getConfiguration(c.id)).toEqual(c);
      });

      it("stores every accessory type", async () => {
        const full: ConfigurationSpec = {
          ...SPEC,
          eyepiece: { focalLengthMm: 25, apparentFovDeg: 50, fieldStopMm: 21.8 },
          camera: { sensorWidthMm: 23.5, sensorHeightMm: 15.7, pixelSizeUm: 3.76, resolutionX: 6248, resolutionY: 4176 },
          barlow: { factor: 2 },
          filter: { name: "UHC", kind: "uhc" },
          mount: { type: "equatorial", payloadKg: 9, goto: true, tracking: true, label: "EQ5" },
          catalogRef: "skywatcher-explorer-200p",
          telescope: { ...SPEC.telescope, label: "Sky-Watcher Explorer 200P" },
          notes: "Test",
        };
        const c = await repo.createConfiguration(full);
        expect(c).toMatchObject(full);
      });

      it("creates multiple configurations from one profile, mirroring its optics", async () => {
        const p = await repo.createProfile(PROFILE);
        const wrongOptics = { ...SPEC, profileId: p.id, telescope: { apertureMm: 50, focalLengthMm: 300 } };
        const a = await repo.createConfiguration(wrongOptics);
        const b = await repo.createConfiguration({ ...wrongOptics, name: "Wide", eyepiece: { focalLengthMm: 32, apparentFovDeg: 52 } });
        expect(a.telescope).toEqual({ apertureMm: 200, focalLengthMm: 1000, opticalDesign: "reflector" });
        expect(b.telescope).toEqual(a.telescope);
        expect((await repo.listConfigurations()).filter((c) => c.profileId === p.id)).toHaveLength(2);
      });

      it("rejects a link to a profile that does not exist", async () => {
        await expect(repo.createConfiguration({ ...SPEC, profileId: MISSING_ID })).rejects.toBeInstanceOf(ValidationError);
      });

      it("rejects invalid configurations", async () => {
        await expect(
          repo.createConfiguration({ ...SPEC, eyepiece: { focalLengthMm: 0, apparentFovDeg: 50 } }),
        ).rejects.toBeInstanceOf(ValidationError);
      });

      it("updating increments the version and replaces accessories", async () => {
        const c = await repo.createConfiguration({ ...SPEC, barlow: { factor: 2 } });
        const u = await repo.updateConfiguration(c.id, { ...SPEC, status: "planned" });
        expect(u.version).toBe(2);
        expect(u.status).toBe("planned");
        expect(u.barlow).toBeUndefined();
        expect(u.createdAt).toBe(c.createdAt);
        await expect(repo.updateConfiguration(MISSING_ID, SPEC)).rejects.toBeInstanceOf(NotFoundError);
      });

      it("duplicates into an independent copy", async () => {
        const c = await repo.createConfiguration({ ...SPEC, camera: { sensorWidthMm: 10, sensorHeightMm: 10, pixelSizeUm: 3 } });
        const d = await repo.duplicateConfiguration(c.id);
        expect(d.id).not.toBe(c.id);
        expect(d.name).toBe("Planetary (copy)");
        expect(d.version).toBe(1);
        expect(d.camera).toEqual(c.camera);
        await repo.updateConfiguration(d.id, { ...SPEC, name: "Changed" });
        expect((await repo.getConfiguration(c.id))?.name).toBe("Planetary");
        await expect(repo.duplicateConfiguration(MISSING_ID)).rejects.toBeInstanceOf(NotFoundError);
      });

      it("profile edits propagate to linked configurations and bump their version", async () => {
        const p = await repo.createProfile(PROFILE);
        const c = await repo.createConfiguration({ ...SPEC, profileId: p.id });
        await repo.updateProfile(p.id, { ...PROFILE, focalLengthMm: 1200 });
        const after = await repo.getConfiguration(c.id);
        expect(after?.telescope.focalLengthMm).toBe(1200);
        expect(after?.version).toBe(2);
      });

      it("deleting a profile unlinks but keeps configurations", async () => {
        const p = await repo.createProfile(PROFILE);
        const c = await repo.createConfiguration({ ...SPEC, profileId: p.id });
        await repo.deleteProfile(p.id);
        const after = await repo.getConfiguration(c.id);
        expect(after?.profileId).toBeUndefined();
        expect(after?.telescope.apertureMm).toBe(200);
      });

      it("returned objects are copies, not live references", async () => {
        const c = await repo.createConfiguration(SPEC);
        c.telescope.apertureMm = 1;
        expect((await repo.getConfiguration(c.id))?.telescope.apertureMm).toBe(200);
      });

      it("deletes configurations", async () => {
        const c = await repo.createConfiguration(SPEC);
        await repo.deleteConfiguration(c.id);
        expect(await repo.getConfiguration(c.id)).toBeUndefined();
        await expect(repo.deleteConfiguration(c.id)).rejects.toBeInstanceOf(NotFoundError);
      });
    });

    describe("sessions (AC-11)", () => {
      const jupiter = getTarget("jupiter")!;
      const m42 = getTarget("m42")!;

      it("saves and reopens a session with the exact snapshot and engine version", async () => {
        const c = await repo.createConfiguration(SPEC);
        const s = await repo.createSession(
          buildSession({
            configuration: c,
            configurationRef: { id: c.id, version: c.version, modified: false },
            target: jupiter,
            mode: "eyepiece",
            conditions: { seeingArcsec: 2 },
            view,
          }),
        );
        const reopened = await repo.getSession(s.id);
        expect(reopened).toEqual(s);
        expect(reopened?.name).toBe("Jupiter · Eyepiece");
        expect(reopened?.configurationRef).toEqual({ id: c.id, version: 1, modified: false });
        expect(reopened?.configurationSnapshot).not.toHaveProperty("id");
        expect(reopened?.configurationSnapshot.eyepiece?.focalLengthMm).toBe(25);
        expect(reopened?.targetSnapshot).toEqual(jupiter);
        expect(checkReproduction(reopened!).identical).toBe(true);
      });

      it("saves camera sessions with exposure settings", async () => {
        const s = await repo.createSession(
          buildSession({
            configuration: { ...SPEC, camera: { sensorWidthMm: 23.5, sensorHeightMm: 15.7, pixelSizeUm: 3.76 } },
            target: m42,
            mode: "camera",
            conditions: {},
            exposure: { exposureS: 30, gain: 2 },
            view: { ...view, zoom: 4 },
          }),
        );
        const reopened = await repo.getSession(s.id);
        expect(reopened?.exposure).toEqual({ exposureS: 30, gain: 2 });
        expect(reopened?.view.zoom).toBe(4);
        expect(reopened?.configurationRef).toBeUndefined();
        expect(checkReproduction(reopened!).identical).toBe(true);
      });

      it("saves the place, sky and air, and reproduces the result", async () => {
        const conditions = {
          seeingArcsec: 1.6,
          skyBrightnessMagArcsec2: 17.42,
          extinctionMag: 0.61,
          airmass: 1.12,
          cloudTransmission: 0.81,
          targetAltitudeDeg: 63.4,
        };
        const s = await repo.createSession(
          buildSession({
            configuration: SPEC,
            target: m42,
            mode: "eyepiece",
            conditions,
            view: {
              ...view,
              observedAt: "2026-11-16T18:00:00.000Z",
              site: { name: "Bangkok", latDeg: 13.8, lonDeg: 100.5, timeZone: "Asia/Bangkok" },
              conditionsSource: "live",
              skySource: "light pollution",
              cloud: 0.2,
            },
          }),
        );
        const reopened = await repo.getSession(s.id);
        expect(reopened?.conditions).toEqual(conditions);
        expect(reopened?.view.site).toEqual({ name: "Bangkok", latDeg: 13.8, lonDeg: 100.5, timeZone: "Asia/Bangkok" });
        expect(reopened?.view.skySource).toBe("light pollution");
        expect(reopened?.result.metrics.skyBrightness?.value).toBe(17.42);
        expect(checkReproduction(reopened!).identical).toBe(true);
      });

      it("is unaffected by later configuration edits or deletion", async () => {
        const c = await repo.createConfiguration(SPEC);
        const s = await repo.createSession(
          buildSession({ configuration: c, target: jupiter, mode: "eyepiece", conditions: {}, view }),
        );
        await repo.updateConfiguration(c.id, { ...SPEC, eyepiece: { focalLengthMm: 6, apparentFovDeg: 82 } });
        await repo.deleteConfiguration(c.id);
        const reopened = await repo.getSession(s.id);
        expect(reopened?.configurationSnapshot.eyepiece?.focalLengthMm).toBe(25);
        if (reopened?.result.mode !== "eyepiece") throw new Error("expected eyepiece");
        expect(reopened.result.metrics.magnification.value).toBe(40);
      });

      it("lists newest first and deletes sessions", async () => {
        const a = await repo.createSession(buildSession({ configuration: SPEC, target: jupiter, mode: "eyepiece", conditions: {}, view }));
        const b = await repo.createSession(buildSession({ configuration: SPEC, target: m42, mode: "eyepiece", conditions: {}, view }));
        expect((await repo.listSessions()).map((s) => s.id)).toEqual([b.id, a.id]);
        await repo.deleteSession(a.id);
        expect((await repo.listSessions()).map((s) => s.id)).toEqual([b.id]);
        await expect(repo.deleteSession(a.id)).rejects.toBeInstanceOf(NotFoundError);
      });
    });

    describe("observation projects", () => {
      const jupiter = getTarget("jupiter")!;
      const newSession = () =>
        repo.createSession(buildSession({ configuration: SPEC, target: jupiter, mode: "eyepiece", conditions: {}, view }));

      it("creates, updates and deletes projects", async () => {
        const p = await repo.createProject({ name: "Planets", description: "Opposition season", targetIds: ["jupiter", "saturn"] });
        expect(p).toMatchObject({ name: "Planets", targetIds: ["jupiter", "saturn"], sessionIds: [] });
        expect(await repo.getProject(p.id)).toEqual(p);

        const u = await repo.updateProject(p.id, { name: "Gas giants", targetIds: ["jupiter"] });
        expect(u.name).toBe("Gas giants");
        expect(u.description).toBeUndefined();
        expect(u.createdAt).toBe(p.createdAt);

        await repo.deleteProject(p.id);
        expect(await repo.listProjects()).toEqual([]);
        await expect(repo.deleteProject(p.id)).rejects.toBeInstanceOf(NotFoundError);
        await expect(repo.updateProject(MISSING_ID, { name: "x", targetIds: [] })).rejects.toBeInstanceOf(NotFoundError);
        expect(await repo.getProject("not-a-uuid")).toBeUndefined();
      });

      it("rejects invalid projects", async () => {
        await expect(repo.createProject({ name: " ", targetIds: [] })).rejects.toBeInstanceOf(ValidationError);
      });

      it("adds and removes sessions without changing them", async () => {
        const p = await repo.createProject({ name: "Planets", targetIds: ["jupiter"] });
        const a = await newSession();
        const b = await newSession();
        await repo.addSessionToProject(p.id, a.id);
        await repo.addSessionToProject(p.id, b.id);
        await repo.addSessionToProject(p.id, a.id); // idempotent
        expect((await repo.getProject(p.id))?.sessionIds).toEqual([a.id, b.id]);

        await repo.removeSessionFromProject(p.id, a.id);
        expect((await repo.getProject(p.id))?.sessionIds).toEqual([b.id]);
        expect(await repo.getSession(a.id)).toEqual(a);

        await expect(repo.addSessionToProject(p.id, MISSING_ID)).rejects.toBeInstanceOf(NotFoundError);
        await expect(repo.addSessionToProject(MISSING_ID, a.id)).rejects.toBeInstanceOf(NotFoundError);
      });

      it("deleting a session removes it from projects; deleting a project keeps sessions", async () => {
        const p = await repo.createProject({ name: "Planets", targetIds: [] });
        const a = await newSession();
        const b = await newSession();
        await repo.addSessionToProject(p.id, a.id);
        await repo.addSessionToProject(p.id, b.id);
        await repo.deleteSession(a.id);
        expect((await repo.getProject(p.id))?.sessionIds).toEqual([b.id]);
        await repo.deleteProject(p.id);
        expect(await repo.getSession(b.id)).toEqual(b);
      });
    });

    describe("discoveries", () => {
      const TYCHO = { targetId: "moon", kind: "feature" as const, featureId: "tycho", name: "Tycho", observedAt: "2026-11-21T14:00:00.000Z", siteName: "Bangkok", setupSummary: "200 mm f/5 · 167×" };

      it("saves once per thing, lists newest first, edits notes and deletes", async () => {
        const a = await repo.createDiscovery(TYCHO);
        expect(a).toMatchObject({ ...TYCHO, id: expect.any(String) });
        // Saving the same thing again keeps the first record.
        const again = await repo.createDiscovery({ ...TYCHO, name: "Tycho again" });
        expect(again.id).toBe(a.id);
        const b = await repo.createDiscovery({ targetId: "jupiter", kind: "companion", featureId: "io", name: "Io" });
        const c = await repo.createDiscovery({ targetId: "m42", kind: "object", name: "Orion Nebula" });
        const list = await repo.listDiscoveries();
        expect(list.map((d) => d.id)).toEqual([c.id, b.id, a.id]);

        const noted = await repo.updateDiscoveryNote(a.id, "  Rays very bright at full Moon  ");
        expect(noted.note).toBe("Rays very bright at full Moon");
        expect((await repo.updateDiscoveryNote(a.id, "")).note).toBeUndefined();

        await repo.deleteDiscovery(b.id);
        expect((await repo.listDiscoveries()).map((d) => d.id)).toEqual([c.id, a.id]);
        await expect(repo.deleteDiscovery(MISSING_ID)).rejects.toBeInstanceOf(NotFoundError);
        await expect(repo.updateDiscoveryNote(MISSING_ID, "x")).rejects.toBeInstanceOf(NotFoundError);
      });

      it("rejects invalid discoveries", async () => {
        await expect(repo.createDiscovery({ ...TYCHO, featureId: undefined })).rejects.toBeInstanceOf(ValidationError);
        await expect(repo.createDiscovery({ targetId: "moon", kind: "object", featureId: "tycho", name: "Moon" })).rejects.toBeInstanceOf(ValidationError);
        await expect(repo.createDiscovery({ ...TYCHO, name: " " })).rejects.toBeInstanceOf(ValidationError);
        await expect(repo.createDiscovery({ ...TYCHO, targetId: "Not An Id" })).rejects.toBeInstanceOf(ValidationError);
        const d = await repo.createDiscovery(TYCHO);
        await expect(repo.updateDiscoveryNote(d.id, "x".repeat(2001))).rejects.toBeInstanceOf(ValidationError);
      });
    });

    it("notifies subscribers on change", async () => {
      let calls = 0;
      const off = repo.subscribe(() => calls++);
      await repo.createProfile(PROFILE);
      off();
      await repo.createProfile(PROFILE);
      expect(calls).toBe(1);
    });
  });
}
