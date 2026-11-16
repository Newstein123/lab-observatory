import { describe, expect, it } from "vitest";
import { galileanMoons, julianDay } from "./satellites";

describe("galileanMoons", () => {
  it("julianDay matches the J2000 epoch", () => {
    expect(julianDay(new Date(Date.UTC(2000, 0, 1, 12)))).toBeCloseTo(2451545.0, 6);
  });

  it("reproduces Meeus example 44.a (1992 Dec 16, 0h UT)", () => {
    const m = galileanMoons(new Date(Date.UTC(1992, 11, 16)));
    const expected = [
      [-3.44, 0.21],
      [7.44, 0.25],
      [1.24, 0.65],
      [7.08, 1.1],
    ];
    m.forEach((moon, i) => {
      expect(moon.x).toBeCloseTo(expected[i][0], 1);
      expect(moon.y).toBeCloseTo(expected[i][1], 1);
    });
  });

  it("agrees with JPL Horizons on which side each moon is (2026 Nov 15, 0h UT)", () => {
    // Horizons offsets east (arcsec): Io +102.2, Europa −91.9, Ganymede −21.1, Callisto −273.8.
    const [io, europa, ganymede, callisto] = galileanMoons(new Date(Date.UTC(2026, 10, 15)));
    expect(io.x).toBeLessThan(0); // east
    expect(europa.x).toBeGreaterThan(0); // west
    expect(ganymede.x).toBeGreaterThan(0);
    expect(callisto.x).toBeGreaterThan(0);
    // Separations scale together (same Jupiter radius in arcsec), within a few per cent.
    const scale = callisto.x / 294.0; // Callisto's Horizons separation ≈ 294″
    expect(europa.x / scale).toBeCloseTo(98.3, -1);
    expect(-io.x / scale).toBeCloseTo(110.2, -1);
  });

  it("marks a moon on the disc as hidden", () => {
    const moons = Array.from({ length: 200 }, (_, h) => galileanMoons(new Date(Date.UTC(2026, 0, 1, h))));
    for (const set of moons) for (const m of set) expect(m.hidden).toBe(m.x * m.x + (m.y / 0.9351) ** 2 < 1);
    expect(moons.flat().some((m) => m.hidden)).toBe(true);
  });
});
