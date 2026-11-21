import { describe, expect, it } from "vitest";
import { getTarget } from "@/modules/targets/catalogue";
import { atmosphericDimming, deepSkyVisibility, horizonTint, skyLevel } from "./atmosphere";
import { cloudOpacity } from "./clouds";
import { limbRotation, litOutline } from "./phase-mask";

describe("atmosphere rendering", () => {
  it("sky level rises from near-black to bright", () => {
    expect(skyLevel(21.9)).toBeLessThan(0.05);
    expect(skyLevel(18)).toBeGreaterThan(0.15);
    expect(skyLevel(12)).toBeGreaterThan(skyLevel(18));
    expect(skyLevel(3)).toBeGreaterThan(0.9);
  });

  it("faint galaxies fade into a bright sky; the Moon doesn't", () => {
    const m101 = getTarget("m101")!;
    const m42 = getTarget("m42")!;
    expect(deepSkyVisibility(m101, 21.9, 0.2)).toBeGreaterThan(0.6);
    expect(deepSkyVisibility(m101, 17.5, 0.2)).toBe(0);
    expect(deepSkyVisibility(m42, 17.5, 0.2)).toBeGreaterThan(0.3);
    expect(deepSkyVisibility(getTarget("moon")!, 10, 0)).toBe(1);
  });

  it("extinction and cloud dim the target; low targets turn warm", () => {
    const m42 = getTarget("m42")!;
    const base = { skyMag: 21, source: "natural" as const, extinctionMag: 0, cloud: 0, altitudeDeg: 60 };
    expect(atmosphericDimming(m42, base)).toBe(1);
    expect(atmosphericDimming(m42, { ...base, extinctionMag: 1 })).toBeCloseTo(0.398, 2);
    expect(atmosphericDimming(m42, { ...base, cloud: 1 })).toBeLessThan(0.1);
    expect(horizonTint(base)).toBeUndefined();
    expect(horizonTint({ ...base, altitudeDeg: 8 })).toMatch(/^rgb/);
  });

  it("cloud opacity grows with cover", () => {
    expect(cloudOpacity(0.5, 0)).toBe(0);
    expect(cloudOpacity(0.5, 0.2)).toBeLessThan(cloudOpacity(0.5, 0.8));
    expect(cloudOpacity(0.3, 1)).toBeGreaterThan(0.9);
  });
});

describe("phase mask", () => {
  const area = (pts: [number, number][]) => Math.abs(pts.reduce((s, [x, y], i) => s + x * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * y, 0) / 2);

  it("lit area matches the illuminated fraction", () => {
    for (const k of [0.1, 0.25, 0.5, 0.75, 0.95]) expect(area(litOutline(k, 200)) / Math.PI).toBeCloseTo(k, 2);
  });

  it("bright limb straight up points the lit side up the screen", () => {
    const r = limbRotation(0);
    // +x rotated by r should point to (0, −1).
    expect(Math.cos(r)).toBeCloseTo(0, 6);
    expect(Math.sin(r)).toBeCloseTo(-1, 6);
    // 90° counter-clockwise from up: towards the left.
    const l = limbRotation(90);
    expect(Math.cos(l)).toBeCloseTo(-1, 6);
  });
});
