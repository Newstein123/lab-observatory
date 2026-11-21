import { describe, expect, it } from "vitest";
import type { ConfigurationSpec } from "@/modules/configurations/models";
import { getTarget } from "@/modules/targets/catalogue";
import { assessReach } from "@/modules/targets/reach";
import { datedTarget, evaluateSky, idealConditions, type SkySetting } from "./conditions";
import { getSite } from "./sites";

const bangkok = getSite("bangkok")!;
const darkSite = getSite("doi-inthanon")!;
// 2026-11-17 01:00 Bangkok time (18:00 UT): Orion high in the east, Moon set, fully dark.
const at = new Date("2026-11-16T18:00:00Z");
const clear = { cloud: 0, haze: "light" as const, seeingArcsec: 2 };
const setting = (site = bangkok, bortle = site.bortle): SkySetting => ({ site, at, bortle, weather: clear });

const spec = {
  name: "8-inch",
  status: "owned",
  telescope: { label: "200/1000", apertureMm: 200, focalLengthMm: 1000 },
  eyepiece: { label: "25 mm", focalLengthMm: 25, apparentFovDeg: 52 },
} as unknown as ConfigurationSpec;

describe("sky evaluation", () => {
  it("Bangkok after midnight: dark, Orion up, light pollution dominates", () => {
    const e = evaluateSky(setting(), getTarget("m42")!);
    expect(e.twilight).toBe("night");
    expect(e.target!.aboveHorizon).toBe(true);
    expect(e.sky.dominant).toBe("light pollution");
    expect(e.conditions.skyBrightnessMagArcsec2!).toBeLessThan(18);
    expect(e.conditions.extinctionMag!).toBeGreaterThan(0);
  });

  it("the same target is easier from a dark site than from Bangkok", () => {
    const rank = { good: 0, challenging: 1, out_of_reach: 2 };
    for (const id of ["m42", "m51", "m101", "m31"]) {
      const t = getTarget(id)!;
      const city = assessReach(t, spec, "eyepiece", evaluateSky(setting(), t).reach);
      const dark = assessReach(t, spec, "eyepiece", evaluateSky(setting(darkSite), t).reach);
      expect(rank[city.reach]).toBeGreaterThanOrEqual(rank[dark.reach]);
    }
  });

  it("Bangkok: the Orion Nebula still shows, the Pinwheel galaxy does not", () => {
    const m42 = getTarget("m42")!;
    const m101 = getTarget("m101")!;
    // Judged as if both were well placed, so only the sky differs.
    const sky = { ...evaluateSky(setting(), m42).reach, altitudeDeg: 60 };
    expect(assessReach(m42, spec, "eyepiece", sky).reach).not.toBe("out_of_reach");
    expect(assessReach(m101, spec, "eyepiece", sky).reach).toBe("out_of_reach");
    expect(assessReach(getTarget("m51")!, spec, "eyepiece", sky).reach).not.toBe("good");
  });

  it("a target below the horizon is out of reach", () => {
    // M51 (dec +47) is below Bangkok's horizon at this hour.
    const t = getTarget("m51")!;
    const e = evaluateSky(setting(), t);
    expect(e.target!.aboveHorizon).toBe(false);
    expect(assessReach(t, spec, "eyepiece", e.reach).reach).toBe("out_of_reach");
  });

  it("ideal conditions: pristine sky, target at its highest", () => {
    const t = getTarget("m42")!;
    const ideal = idealConditions(setting(), t);
    expect(ideal.conditions.skyBrightnessMagArcsec2).toBe(21.9);
    // M42 (dec −5.4) culminates at 90 − |13.76 + 5.39| ≈ 70.9° from Bangkok.
    expect(ideal.altitudeDeg).toBeCloseTo(70.9, 0);
    expect(ideal.conditions.cloudTransmission).toBe(1);
  });

  it("dates the planets: size and brightness for that night", () => {
    const jupiter = getTarget("jupiter")!;
    const e = evaluateSky(setting(), jupiter);
    const dated = datedTarget(jupiter, e.target);
    expect(dated.angularSize.majorAxisArcsec).toBeCloseTo(37.5, 0); // Horizons: 37.48″ on 2026-11-16
    expect(dated.magnitude).toBeCloseTo(-2.1, 1);
  });
});
