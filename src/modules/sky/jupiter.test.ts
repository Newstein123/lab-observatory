import { describe, expect, it } from "vitest";
import { grsLongitude, jupiterOrientation, projectJovian } from "./jupiter";

describe("Jupiter's orientation", () => {
  it("matches Meeus example 43.a (1992 Dec 16, 0h UT)", () => {
    const o = jupiterOrientation(new Date(Date.UTC(1992, 11, 16)));
    // Meeus works in dynamical time (ΔT was 59 s in 1992; 69 s is used here): within 0.5°.
    expect(Math.abs(o.cm1Deg - 268.06)).toBeLessThan(0.5);
    expect(Math.abs(o.cm2Deg - 72.74)).toBeLessThan(0.5);
    // JPL Horizons: sub-observer latitude −2.84° planetodetic = −2.48° planetocentric; pole angle 24.80°.
    expect(o.subLatDeg).toBeCloseTo(-2.48, 1);
    expect(Math.abs(o.axisPaDeg - 24.8)).toBeLessThan(0.3);
  });

  it("agrees with Horizons on the pole angle in 2026", () => {
    expect(Math.abs(jupiterOrientation(new Date("2026-11-21T14:00:00Z")).axisPaDeg - 22.06)).toBeLessThan(0.3);
  });

  it("puts the central meridian at the centre and moves features west with rotation", () => {
    const o = { cm2Deg: 100, subLatDeg: 0, axisPaDeg: 0 };
    expect(projectJovian(0, 100, o).x).toBeCloseTo(0, 9);
    // A larger System II longitude is still east of the central meridian (arrives later): sky east = left.
    expect(projectJovian(0, 130, o).x).toBeLessThan(0);
    expect(projectJovian(0, 280, o).z).toBeLessThan(0); // far side
    expect(projectJovian(-22, 100, o).y).toBeGreaterThan(0.3); // south is down
  });

  it("follows the Great Red Spot's drift model, or a measured value", () => {
    expect(grsLongitude(new Date("2026-06-01T00:00:00Z"))).toBeCloseTo(91, 6);
    expect(grsLongitude(new Date("2026-12-01T00:00:00Z"))).toBeCloseTo(91 + 1.75 * 6, 0);
    expect(grsLongitude(new Date("2026-12-01T00:00:00Z"), { lonDeg: 100, atIso: "2026-12-01T00:00:00Z" })).toBeCloseTo(100, 6);
  });
});
