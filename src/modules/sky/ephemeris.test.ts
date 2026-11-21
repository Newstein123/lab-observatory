import { describe, expect, it } from "vitest";
import { bodyState } from "./bodies";
import { airmass, precessFromJ2000, separation, toHorizontal } from "./coords";
import { altitudeFn, bodyEvents, HORIZON_MOON, nightInfo } from "./events";
import { moonPhase, moonPosition, nextLunarPhase, topocentric } from "./moon";
import { planetPosition, type PlanetId } from "./planets";
import { sunPosition } from "./sun";
import { gmst } from "./time";

/**
 * Reference values from NASA JPL Horizons (geocentric apparent RA/Dec, visual
 * magnitude, illuminated %, angular diameter), retrieved 2026-11-16.
 */
const HORIZONS: { id: "moon" | PlanetId; at: string; ra: number; dec: number; mag: number; lit: number; diam: number }[] = [
  { id: "moon", at: "2026-11-16T12:00:00Z", ra: 315.95347, dec: -17.86702, mag: -9.618, lit: 40.6212, diam: 1785.952 },
  { id: "moon", at: "2025-03-01T00:00:00Z", ra: 354.5469, dec: -2.7086, mag: -5.451, lit: 1.344, diam: 1976.662 },
  { id: "moon", at: "2028-07-04T06:00:00Z", ra: 251.11239, dec: -25.73803, mag: -11.894, lit: 93.34952, diam: 1859.885 },
  { id: "mercury", at: "2026-11-16T12:00:00Z", ra: 214.22215, dec: -11.23896, mag: -0.143, lit: 41.59562, diam: 7.612566 },
  { id: "mercury", at: "2028-07-04T06:00:00Z", ra: 81.91702, dec: 21.30268, mag: -0.213, lit: 55.72555, diam: 6.772219 },
  { id: "venus", at: "2026-11-16T12:00:00Z", ra: 200.8512, dec: -9.95723, mag: -4.831, lit: 14.7796, diam: 49.33959 },
  { id: "venus", at: "2025-03-01T00:00:00Z", ra: 7.27348, dec: 10.44476, mag: -4.804, lit: 14.6284, diam: 48.74481 },
  { id: "mars", at: "2026-11-16T12:00:00Z", ra: 148.92182, dec: 14.68361, mag: 0.628, lit: 89.46925, diam: 7.187198 },
  { id: "mars", at: "2025-03-01T00:00:00Z", ra: 109.10306, dec: 25.8522, mag: -0.254, lit: 93.819, diam: 10.86219 },
  { id: "jupiter", at: "2026-11-16T12:00:00Z", ra: 148.41912, dec: 13.58403, mag: -2.093, lit: 99.12948, diam: 37.48329 },
  { id: "jupiter", at: "2028-07-04T06:00:00Z", ra: 172.40869, dec: 4.60452, mag: -1.863, lit: 99.24132, diam: 34.3598 },
  { id: "saturn", at: "2026-11-16T12:00:00Z", ra: 8.81345, dec: 0.9285, mag: 0.538, lit: 99.85856, diam: 19.09459 },
  { id: "saturn", at: "2025-03-01T00:00:00Z", ra: 352.20027, dec: -5.44644, mag: 1.114, lit: 99.99167, diam: 15.69935 },
  { id: "uranus", at: "2026-11-16T12:00:00Z", ra: 62.10822, dec: 20.8128, mag: 5.601, lit: 99.99807, diam: 3.818484 },
  { id: "neptune", at: "2026-11-16T12:00:00Z", ra: 2.21847, dec: -0.57215, mag: 7.708, lit: 99.98285, diam: 2.333655 },
];

const BANGKOK = { latDeg: 13.7563, lonDeg: 100.5018 };
const minutesApart = (a: Date | undefined, b: string) => Math.abs((a?.getTime() ?? NaN) - Date.parse(b)) / 60_000;

describe("sky positions vs JPL Horizons", () => {
  it("sidereal time matches Meeus example 12.a", () => {
    // 1987 April 10, 0h UT: GMST = 13h10m46.3668s = 197.693195°.
    expect(gmst(new Date(Date.UTC(1987, 3, 10)))).toBeCloseTo(197.693195, 4);
  });

  it("Sun within 0.01°", () => {
    const s = sunPosition(new Date("2026-11-16T12:00:00Z"));
    expect(separation(s, { raDeg: 231.77004, decDeg: -18.80608 })).toBeLessThan(0.01);
  });

  it("Moon matches Meeus example 47.a (1992 April 12, 0h TD)", () => {
    const m = moonPosition(new Date(Date.UTC(1992, 3, 12, 0, 0, 0) - 59_000)); // TD − UT ≈ 59 s
    expect(m.lonDeg).toBeCloseTo(133.162655, 1);
    expect(m.latDeg).toBeCloseTo(-3.229126, 1);
    expect(m.distanceKm).toBeGreaterThan(368_300);
    expect(m.distanceKm).toBeLessThan(368_500);
  });

  for (const ref of HORIZONS) {
    it(`${ref.id} at ${ref.at}`, () => {
      const date = new Date(ref.at);
      if (ref.id === "moon") {
        const m = moonPosition(date);
        const p = moonPhase(date);
        expect(separation(m, { raDeg: ref.ra, decDeg: ref.dec })).toBeLessThan(0.05);
        expect(Math.abs(p.illuminated * 100 - ref.lit)).toBeLessThan(0.5);
        expect(Math.abs(p.diameterArcsec - ref.diam)).toBeLessThan(10);
        expect(Math.abs(p.magnitude - ref.mag)).toBeLessThan(0.4);
        return;
      }
      const p = planetPosition(ref.id, date);
      expect(separation(p, { raDeg: ref.ra, decDeg: ref.dec })).toBeLessThan(0.12);
      expect(Math.abs(p.magnitude - ref.mag)).toBeLessThan(0.15);
      expect(Math.abs(p.illuminated * 100 - ref.lit)).toBeLessThan(1);
      const globe = ref.id === "saturn" ? p.majorArcsec / 2.27 : p.majorArcsec;
      expect(Math.abs(globe - ref.diam) / ref.diam).toBeLessThan(0.02);
    });
  }

  it("topocentric Moon from Bangkok (Horizons, airless)", () => {
    const date = new Date("2026-11-16T12:00:00Z");
    const m = moonPosition(date);
    const topo = topocentric(m, m.distanceKm, BANGKOK, date);
    expect(separation(topo, { raDeg: 315.62877, decDeg: -18.33227 })).toBeLessThan(0.1);
    const hz = toHorizontal(topo, BANGKOK, date);
    expect(hz.altDeg).toBeCloseTo(52.103, 0);
    expect(hz.azDeg).toBeCloseTo(212.68, 0);
  });
});

describe("rise, set and the night", () => {
  it("Bangkok sunset and sunrise within 2 minutes of Horizons", () => {
    const night = nightInfo(new Date("2026-11-16T12:00:00Z"), BANGKOK);
    expect(minutesApart(night.sunset, "2026-11-16T10:48:00Z")).toBeLessThan(2);
    expect(minutesApart(night.sunrise, "2026-11-16T23:19:00Z")).toBeLessThan(2);
    expect(night.darkStart!.getTime()).toBeGreaterThan(night.sunset!.getTime());
    expect(night.darkEnd!.getTime()).toBeLessThan(night.sunrise!.getTime());
  });

  it("Bangkok moonset within 3 minutes of Horizons", () => {
    const alt = altitudeFn((d) => {
      const m = moonPosition(d);
      return topocentric(m, m.distanceKm, BANGKOK, d);
    }, BANGKOK);
    const ev = bodyEvents(alt, HORIZON_MOON, new Date("2026-11-16T00:00:00Z"), new Date("2026-11-17T00:00:00Z"));
    expect(minutesApart(ev.rise, "2026-11-16T04:47:00Z")).toBeLessThan(3);
    expect(minutesApart(ev.set, "2026-11-16T16:30:00Z")).toBeLessThan(3);
    expect(minutesApart(ev.transit.at, "2026-11-16T10:38:00Z")).toBeLessThan(5);
  });

  it("finds the next full Moon", () => {
    // Full Moon 2026-11-24 14:53 UT (USNO).
    expect(minutesApart(nextLunarPhase(new Date("2026-11-16T00:00:00Z"), 180), "2026-11-24T14:53:00Z")).toBeLessThan(30);
  });
});

describe("helpers", () => {
  it("air mass is 1 overhead and about 2 at 30°", () => {
    expect(airmass(90)).toBeCloseTo(1, 2);
    expect(airmass(30)).toBeCloseTo(2, 1);
    expect(airmass(-1)).toBeUndefined();
  });

  it("precession moves Polaris by the expected amount", () => {
    // ~0.36° in RA·cosδ… check the size of the shift over 25 years is sensible (< 0.5°).
    const p = precessFromJ2000({ raDeg: 37.95, decDeg: 89.26 }, 0.25);
    expect(separation(p, { raDeg: 37.95, decDeg: 89.26 })).toBeGreaterThan(0.05);
    expect(separation(p, { raDeg: 37.95, decDeg: 89.26 })).toBeLessThan(0.5);
  });

  it("body state gives the Moon a phase and a visible orientation", () => {
    const s = bodyState({ id: "moon" }, new Date("2026-11-16T12:00:00Z"), BANGKOK)!;
    expect(s.aboveHorizon).toBe(true);
    expect(s.phase!.illuminated).toBeGreaterThan(0.35);
    expect(s.phase!.illuminated).toBeLessThan(0.46);
    expect(s.direction).toMatch(/S/);
  });
});
