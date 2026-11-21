import { describe, expect, it } from "vitest";
import { planetPosition } from "@/modules/sky/planets";
import { galileanMoons, julianDay, satellitesOf } from "./satellites";

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

  it("places the moons on the sky within a few arcseconds of JPL Horizons, tilt included", () => {
    // Horizons geocentric apparent offsets from Jupiter, arcsec [east, north], retrieved 2026-11-21.
    const refs: { at: string; moons: Record<string, [number, number]> }[] = [
      { at: "2025-09-02T00:00:00Z", moons: { Io: [96.8, -14.6], Europa: [99.2, -19.5], Ganymede: [-252.3, 39.4], Callisto: [-419.0, 61.6] } },
      { at: "2025-11-02T00:00:00Z", moons: { Io: [-103.9, 20.6], Europa: [-56.3, 8.8], Ganymede: [297.4, -63.0], Callisto: [461.2, -102.5] } },
    ];
    for (const ref of refs) {
      const date = new Date(ref.at);
      const radius = planetPosition("jupiter", date).majorArcsec / 2;
      for (const m of satellitesOf("jupiter", date)) {
        const [east, north] = ref.moons[m.name];
        expect(Math.hypot(-m.x * radius - east, m.y * radius - north), `${m.name} ${ref.at}`).toBeLessThan(4);
      }
    }
  });
});
