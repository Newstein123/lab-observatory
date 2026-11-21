import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { terrainAssets } from "./lunar/assets";
import { craterMetrics, elevationAt, profile, type Terrain } from "./terrain";

/** A synthetic crater: 2 km deep bowl, rim 500 m above the plain, 1 km central peak. */
function synthetic(n = 200, sideKm = 100, d = 40): Terrain {
  const elevation = new Int16Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = ((j + 0.5) / n - 0.5) * sideKm;
      const y = (0.5 - (i + 0.5) / n) * sideKm;
      const r = Math.hypot(x, y) / (d / 2);
      let e = r < 1 ? -2000 + 2500 * r ** 4 : 500 * Math.exp(-(r - 1) * 3);
      if (r < 0.2) e += 1000 * (1 - r / 0.2);
      elevation[i * n + j] = Math.round(e);
    }
  return { featureId: "x", n, sideKm, kmPerSample: sideKm / n, elevation, minM: -2000, maxM: 1000, albedoSrc: "" };
}

describe("terrain measurements", () => {
  it("measures a synthetic crater", () => {
    const m = craterMetrics(synthetic(), 40);
    expect(m.rimM).toBeGreaterThan(400);
    expect(m.floorM).toBeLessThan(-1800);
    expect(m.depthM).toBeGreaterThan(2200);
    expect(m.depthM).toBeLessThan(2600);
    expect(m.rimRadiusKm).toBeCloseTo(20, -1);
    expect(m.centralPeakM).toBeGreaterThan(600);
  });

  it("samples elevation and profiles in the right orientation", () => {
    const t = synthetic();
    expect(elevationAt(t, 0, 0)).toBeGreaterThan(-1500); // peak
    const p = profile(t, 90, 90, 91);
    expect(p[0].dKm).toBe(0);
    expect(p[45].elevationM).toBeCloseTo(elevationAt(t, 0, 0), 0);
  });

  it("gives Tycho a depth close to published values (LOLA data)", () => {
    const a = terrainAssets("tycho")!;
    const buf = readFileSync(path.join(process.cwd(), "public", a.dem.src));
    const w = a.dem.window!;
    const t: Terrain = {
      featureId: "tycho",
      n: w.samples,
      sideKm: w.sideKm,
      kmPerSample: w.kmPerSample,
      elevation: new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2),
      minM: a.dem.minM!,
      maxM: a.dem.maxM!,
      albedoSrc: a.albedo.src,
    };
    const m = craterMetrics(t, 85.3);
    // Literature: about 4.5–4.8 km rim to floor.
    expect(m.depthM).toBeGreaterThan(4000);
    expect(m.depthM).toBeLessThan(5200);
    expect(m.centralPeakM).toBeDefined();
  });
});
