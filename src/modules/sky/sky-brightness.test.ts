import { describe, expect, it } from "vitest";
import { airmass } from "./coords";
import {
  bortleSqm,
  cloudTransmission,
  extinctionCoefficient,
  moonlightFlux,
  nakedEyeLimit,
  NATURAL_SKY,
  seeingAtAirmass,
  skyBrightness,
  toFlux,
  twilightMag,
} from "./sky-brightness";

const dark = { zenithSqm: NATURAL_SKY, sunAltDeg: -40, moonAltDeg: -20, moonPhaseAngleDeg: 0, moonSeparationDeg: 90, targetAltDeg: 90, k: 0.17, cloud: 0 };

describe("sky brightness", () => {
  it("is the natural value at the zenith on a dark moonless night", () => {
    expect(skyBrightness(dark).mag).toBeCloseTo(NATURAL_SKY, 1);
    expect(skyBrightness(dark).dominant).toBe("natural");
  });

  it("Bangkok's sky is dominated by light pollution and limits the eye to about mag 3.5", () => {
    const s = skyBrightness({ ...dark, zenithSqm: bortleSqm(9) });
    expect(s.dominant).toBe("light pollution");
    expect(s.mag).toBeCloseTo(17.5, 1);
    expect(nakedEyeLimit(s.mag)).toBeGreaterThan(3.2);
    expect(nakedEyeLimit(s.mag)).toBeLessThan(3.9);
    expect(nakedEyeLimit(NATURAL_SKY)).toBeGreaterThan(6.3);
  });

  it("gets brighter towards the horizon", () => {
    expect(skyBrightness({ ...dark, targetAltDeg: 15 }).mag).toBeLessThan(skyBrightness(dark).mag - 0.3);
  });

  it("moonlight: K&S worked example (≈ 1/2 moon, 45° away) is a few mag brighter than dark sky", () => {
    // Paper fig. 2 regime: gibbous Moon high up brightens a nearby field by 2–4 mag.
    const near = skyBrightness({ ...dark, moonAltDeg: 60, moonPhaseAngleDeg: 30, moonSeparationDeg: 30, targetAltDeg: 60 });
    expect(near.dominant).toBe("moonlight");
    expect(NATURAL_SKY - near.mag).toBeGreaterThan(2);
    expect(NATURAL_SKY - near.mag).toBeLessThan(4.5);
    // Brighter phase → more light; farther away → less.
    const args = { moonAltDeg: 50, separationDeg: 60, targetAltDeg: 50, k: 0.17 };
    expect(moonlightFlux({ ...args, moonPhaseAngleDeg: 0 })).toBeGreaterThan(moonlightFlux({ ...args, moonPhaseAngleDeg: 90 }));
    expect(moonlightFlux({ ...args, moonPhaseAngleDeg: 0, separationDeg: 120 })).toBeLessThan(moonlightFlux({ ...args, moonPhaseAngleDeg: 0 }));
    expect(moonlightFlux({ ...args, moonPhaseAngleDeg: 0, moonAltDeg: -5 })).toBe(0);
  });

  it("twilight fades to nothing at −18°", () => {
    expect(twilightMag(-3)!).toBeLessThan(twilightMag(-10)!);
    expect(twilightMag(-18)).toBeUndefined();
    expect(skyBrightness({ ...dark, sunAltDeg: -8 }).dominant).toBe("twilight");
  });

  it("clouds over a city reflect its light back down", () => {
    const city = { ...dark, zenithSqm: bortleSqm(8) };
    expect(skyBrightness({ ...city, cloud: 1 }).mag).toBeLessThan(skyBrightness(city).mag);
    expect(cloudTransmission(0)).toBe(1);
    expect(cloudTransmission(1)).toBeLessThan(0.1);
  });
});

describe("extinction and seeing", () => {
  it("haze and low altitude dim the target", () => {
    const clean = extinctionCoefficient({ aerosolOpticalDepth: 0.05 });
    const hazy = extinctionCoefficient({ aerosolOpticalDepth: 0.5 });
    expect(clean).toBeGreaterThan(0.15);
    expect(clean).toBeLessThan(0.2);
    expect(hazy).toBeGreaterThan(0.6);
    expect(clean * airmass(20)!).toBeGreaterThan(clean * airmass(70)!);
    // A mountain site has less air above it.
    expect(extinctionCoefficient({ aerosolOpticalDepth: 0.05, elevationM: 2500 })).toBeLessThan(clean);
  });

  it("seeing worsens with air mass", () => {
    expect(seeingAtAirmass(2, 2)).toBeCloseTo(2 * 2 ** 0.6, 5);
  });

  it("relative flux round-trips", () => {
    expect(toFlux(NATURAL_SKY)).toBeCloseTo(1, 10);
    expect(toFlux(NATURAL_SKY - 2.5)).toBeCloseTo(10, 6);
  });

  it("never reports a sky darker than any real one (and stays within the engine's range)", () => {
    const worst = skyBrightness({ zenithSqm: 21.9, k: 0.99, cloud: 1, targetAltDeg: 2, sunAltDeg: -40, moonAltDeg: -30, moonPhaseAngleDeg: 180, moonSeparationDeg: 120 });
    expect(worst.mag).toBeLessThanOrEqual(22.3);
  });
});
