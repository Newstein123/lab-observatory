import { describe, expect, it } from "vitest";
import { moonOrientation, projectSelenographic } from "@/modules/sky/moon";
import { getTarget } from "@/modules/targets/catalogue";
import { chooseLabels, classifyObservability, featureAt, fromScreen, placeLunarFeatures, ringAt, toScreen, type ViewGeometry } from "./identify";
import { hoursToCentralMeridian, surfaceGeometry } from "./projection";
import { LUNAR_ASSETS, terrainAssets } from "./lunar/assets";
import { getLunarFeature, LUNAR_FEATURES } from "./lunar/features";
import { explorerObjectFor } from "./objects";
import { tabsFor } from "./registry";
import { getSource } from "./sources";

const o = moonOrientation(new Date("2026-11-19T13:58:00Z"), { latDeg: 13.76, lonDeg: 100.5 });
const view = (orientation: ViewGeometry["orientation"], pan = { x: 0, y: 0 }): ViewGeometry => ({
  width: 560,
  height: 560,
  targetPx: 1100,
  panPx: pan,
  orientation,
  fieldRadiusPx: 280,
});

describe("identification in the view", () => {
  for (const orientation of ["sky", "diagonal", "inverted"] as const) {
    it(`finds Tycho where it is drawn (${orientation})`, () => {
      const tycho = getLunarFeature("tycho")!;
      const d = projectSelenographic(tycho.latDeg, tycho.lonDeg, o);
      // Pan so that Tycho sits near the field centre, as when the user slews to it.
      const v = view(orientation, { x: -d.x * 550, y: -d.y * 550 + 20 });
      const s = toScreen(v, d.x, d.y);
      const placed = placeLunarFeatures(LUNAR_FEATURES, o, v);
      expect(featureAt(placed, s.x + 3, s.y - 2)?.feature.id).toBe("tycho");
      const back = fromScreen(v, s.x, s.y);
      expect(back.x).toBeCloseTo(d.x, 9);
      expect(back.y).toBeCloseTo(d.y, 9);
    });
  }

  it("prefers the smaller feature inside a larger one", () => {
    const v = view("sky");
    const placed = placeLunarFeatures(LUNAR_FEATURES, o, { ...v, targetPx: 4000 });
    const statio = placed.find((p) => p.feature.id === "archimedes")!;
    expect(featureAt(placed, statio.x, statio.y)?.feature.id).toBe("archimedes"); // not Mare Imbrium
  });

  it("does not label far-side or out-of-field features", () => {
    const placed = placeLunarFeatures(LUNAR_FEATURES, o, view("sky"));
    for (const p of chooseLabels(placed)) expect(p.inField && p.nearSide).toBe(true);
    // Labels do not overlap.
    const chosen = chooseLabels(placed);
    for (const a of chosen) for (const b of chosen) if (a !== b) expect(Math.abs(a.x - b.x) >= 84 || Math.abs(a.y - b.y) >= 22).toBe(true);
  });
});

describe("observability", () => {
  it("resolves Tycho in a 130 mm at 339×", () => {
    expect(classifyObservability(85.3, 384_400, { resolutionArcsec: 1.5, magnification: 339 }).resolvability).toBe("resolved");
  });
  it("cannot resolve the Apollo 11 hardware", () => {
    expect(classifyObservability(0.005, 384_400, { resolutionArcsec: 0.9, magnification: 339 }).resolvability).toBe("identified-by-position");
  });
  it("needs enough magnification for the eye", () => {
    // Plato (101 km ≈ 54″) at 1×: physically resolved, but far too small for the eye to see its shape.
    expect(classifyObservability(101, 384_400, { resolutionArcsec: 1.5, magnification: 1.5 }).resolvability).not.toBe("resolved");
  });
});

describe("explorer registry", () => {
  it("gives the Moon its visualisations", () => {
    const moon = explorerObjectFor(getTarget("moon")!);
    expect(tabsFor(moon, { kind: "feature", id: "tycho" })).toEqual(["info", "model", "map", "learn"]);
  });
  it("gives Jupiter's moons an orbit view but no surface views", () => {
    const j = explorerObjectFor(getTarget("jupiter")!);
    expect(tabsFor(j, { kind: "companion", id: "io" })).toEqual(["info", "model", "learn"]);
    expect(tabsFor(j, { kind: "companion", id: "io" })).not.toContain("map");
  });
  it("never shows a planetary surface map for a nebula", () => {
    const m42 = explorerObjectFor(getTarget("m42")!);
    const tabs = tabsFor(m42, { kind: "object" });
    expect(tabs).not.toContain("map");
    expect(tabs).not.toContain("model");
  });
});

describe("data integrity", () => {
  it("every feature, property and section cites known sources", () => {
    for (const f of LUNAR_FEATURES) {
      expect(f.sourceIds.length).toBeGreaterThan(0);
      for (const id of [...f.sourceIds, ...f.properties.flatMap((p) => p.sourceIds), ...f.learn.flatMap((l) => l.sourceIds)]) {
        expect(getSource(id), `${f.id}: ${id}`).toBeDefined();
      }
      for (const r of f.related) expect(getLunarFeature(r), `${f.id} → ${r}`).toBeDefined();
      expect(Math.abs(f.latDeg)).toBeLessThanOrEqual(90);
      expect(Math.abs(f.lonDeg)).toBeLessThanOrEqual(180);
    }
  });
  it("every asset has provenance, and terrain features have their crops", () => {
    for (const [k, a] of Object.entries(LUNAR_ASSETS)) {
      expect(a.source, k).toBeTruthy();
      expect(a.retrievedAt, k).toBeTruthy();
    }
    for (const f of LUNAR_FEATURES.filter((x) => x.terrain)) expect(terrainAssets(f.id), f.id).toBeDefined();
  });
});

describe("Saturn's rings in the view", () => {
  const unitKm = 60_268 * 2.27;
  const g = { tiltDeg: 20, poleDeg: 0, unitKm, globeKm: 60_268, globeRatio: 0.902 };
  const v = { width: 400, height: 400, targetPx: 300, panPx: { x: 0, y: 0 }, orientation: "sky" as const };
  const at = (rhoKm: number) => toScreen(v, rhoKm / unitKm, 0);
  const saturn = explorerObjectFor(getTarget("saturn")!);

  it("finds a ring or gap by its distance from the centre at the ansae", () => {
    const p = at(119_800); // middle of the Cassini Division
    expect(ringAt(saturn.rings, g, v, p.x, p.y)).toMatchObject({ id: "cassini-division" });
    const b = at(-105_000); // east ansa, B ring
    expect(ringAt(saturn.rings, g, v, b.x, b.y)).toMatchObject({ id: "b-ring" });
  });

  it("knows the globe from the rings crossing in front of it", () => {
    const c = toScreen(v, 0, 0);
    expect(ringAt(saturn.rings, g, v, c.x, c.y)).toBe("globe");
    // With the north face towards us (B > 0) the near side of the B ring crosses the globe south of centre.
    const y = (105_000 * Math.sin((20 * Math.PI) / 180)) / unitKm;
    const front = toScreen(v, 0, y);
    expect(ringAt(saturn.rings, g, v, front.x, front.y)).toMatchObject({ id: "b-ring" });
  });

  it("rotates with the pole angle", () => {
    const p = toScreen(v, 0, -119_800 / unitKm); // where the west ansa goes with the pole at 90°
    expect(ringAt(saturn.rings, { ...g, poleDeg: 90 }, v, p.x, p.y)).toMatchObject({ id: "cassini-division" });
  });
});

describe("Jupiter's features in the view", () => {
  const jupiter = explorerObjectFor(getTarget("jupiter")!);
  it("puts the Great Red Spot near the centre when it transits", () => {
    const date = new Date("2026-11-21T21:00:00Z");
    const g0 = surfaceGeometry(jupiter, date)!;
    const h = hoursToCentralMeridian(g0.jupiter!, g0.jupiter!.grsLonDeg);
    const transit = new Date(date.getTime() + h * 3_600_000);
    const g = surfaceGeometry(jupiter, transit)!;
    const grs = jupiter.features.find((f) => f.id === "great-red-spot")!;
    const d = g.project!(grs);
    expect(Math.abs(d.x)).toBeLessThan(0.15); // on the central meridian (turned only by the axis angle)
    expect(d.z).toBeGreaterThan(0.8);
  });
  it("keeps belts on the central meridian", () => {
    const g = surfaceGeometry(jupiter, new Date("2026-11-21T21:00:00Z"))!;
    const ez = jupiter.features.find((f) => f.id === "equatorial-zone")!;
    expect(Math.hypot(g.project!(ez).x, g.project!(ez).y)).toBeLessThan(0.05);
  });
});

describe("deep-sky features", () => {
  const m42 = explorerObjectFor(getTarget("m42")!);
  const m45 = explorerObjectFor(getTarget("m45")!);

  it("come from SIMBAD with sources, inside the survey image", () => {
    expect(m42.features.map((f) => f.id)).toEqual(expect.arrayContaining(["trapezium", "m43", "running-man", "orion-kl"]));
    expect(tabsFor(m42, { kind: "feature", id: "trapezium" })).toEqual(["info", "image", "learn"]);
    for (const f of [...m42.features, ...m45.features]) {
      expect(f.catalogue?.simbadId).toBeTruthy();
      for (const id of f.sourceIds) expect(getSource(id), `${f.id}: ${id}`).toBeDefined();
    }
  });

  it("are placed by their offsets from the image centre (north up, east left)", () => {
    const g = surfaceGeometry(m42, new Date())!;
    const running = m42.features.find((f) => f.id === "running-man")!;
    const d = g.project!(running);
    const R = m42.skyImage!.radiusArcsec;
    // NGC 1977 is ~34′ north of the image centre and slightly west.
    const northArcmin = (-d.y * R) / 60;
    expect(northArcmin).toBeGreaterThan(30);
    expect(northArcmin).toBeLessThan(38);
    expect(Math.abs((d.x * R) / 60)).toBeLessThan(2);
  });

  it("give Pleiades stars catalogue magnitudes and parallax distances", () => {
    const alcyone = m45.features.find((f) => f.id === "alcyone")!;
    expect(alcyone.catalogue?.vMag).toBeCloseTo(2.87, 1);
    const dist = alcyone.properties.find((p) => p.label === "Distance")!;
    expect(dist.kind).toBe("calculated");
    expect(Number(dist.value.replace(/[^\d]/g, ""))).toBeGreaterThan(380);
    expect(Number(dist.value.replace(/[^\d]/g, ""))).toBeLessThan(450);
  });
});
