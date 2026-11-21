import { describe, expect, it } from "vitest";
import { buildSession } from "@/modules/sessions/models";
import { getTarget } from "@/modules/targets/catalogue";
import { createLocalRepository, createMemoryStore, STORAGE_KEY } from "./local-repository";
import { PROFILE, runRepositoryContract, SPEC } from "./repository.contract";

let clock = Date.UTC(2026, 10, 14, 12);
runRepositoryContract("local", async () =>
  createLocalRepository(createMemoryStore(), { now: () => new Date((clock += 1000)) }),
);

describe("local repository: storage specifics", () => {
  it("persists across repository instances", async () => {
    const store = createMemoryStore();
    await createLocalRepository(store).createProfile(PROFILE);
    expect(await createLocalRepository(store).listProfiles()).toHaveLength(1);
  });

  it("upgrades a version 1 document without losing data", async () => {
    const v1 = {
      schemaVersion: 1,
      profiles: [
        {
          id: "p1",
          name: "Old scope",
          opticalDesign: "refractor",
          apertureMm: 80,
          focalLengthMm: 480,
          mountType: "alt_azimuth",
          createdAt: "2026-11-01T00:00:00.000Z",
          updatedAt: "2026-11-01T00:00:00.000Z",
        },
      ],
      configurations: [],
      sessions: [],
    };
    const store = createMemoryStore({ [STORAGE_KEY]: JSON.stringify(v1) });
    const r = createLocalRepository(store);
    const [p] = await r.listProfiles();
    expect(p).toMatchObject({ id: "p1", name: "Old scope", status: "owned" });
    expect(await r.listAccessories()).toEqual([]);
    expect(await r.listProjects()).toEqual([]);
    await r.createProject({ name: "New", targetIds: [] });
    expect(JSON.parse(store.dump()[STORAGE_KEY]).schemaVersion).toBe(3);
    expect(await r.listDiscoveries()).toEqual([]);
  });

  it("sets aside corrupt data instead of crashing", async () => {
    const corrupt = createMemoryStore({ [STORAGE_KEY]: "{not json" });
    let backup = "";
    const r = createLocalRepository(corrupt, { onCorruptData: (k) => (backup = k) });
    expect(await r.listProfiles()).toEqual([]);
    expect(backup).toMatch(/:corrupt:/);
    expect(corrupt.dump()[backup]).toBe("{not json");
  });

  it("buildSession recomputes the result and drops exposure for eyepiece sessions", () => {
    const s = buildSession({
      configuration: SPEC,
      target: getTarget("jupiter")!,
      mode: "eyepiece",
      conditions: {},
      exposure: { exposureS: 1, gain: 1 },
      view: { focusOffset: 0, longExposureColor: false, zoom: 1 },
    });
    if (s.result.mode !== "eyepiece") throw new Error("expected eyepiece");
    expect(s.result.metrics.magnification.value).toBe(40);
    expect(s.exposure).toBeUndefined();
  });
});

describe("sessions saved by engine 1.0.0", () => {
  it("still reproduce: new metrics only appear with filter types or untracked exposures", async () => {
    const { checkReproduction } = await import("@/modules/sessions/models");
    const { ENGINE_VERSION } = await import("@/modules/simulations/engine");
    const s = buildSession({
      configuration: { ...SPEC, filter: { name: "Moon filter" } },
      target: getTarget("m42")!,
      mode: "eyepiece",
      conditions: { seeingArcsec: 2 },
      view: { focusOffset: 0, longExposureColor: false, zoom: 1 },
    });
    const old = { ...s, id: "x", createdAt: "2026-11-14T00:00:00.000Z", engineVersion: "1.0.0", result: { ...s.result, engineVersion: "1.0.0" } };
    const check = checkReproduction(old);
    expect(check.identical).toBe(true);
    expect(check.savedVersion).toBe("1.0.0");
    expect(check.currentVersion).toBe(ENGINE_VERSION);
  });
});
