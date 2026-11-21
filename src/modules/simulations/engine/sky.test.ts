import { describe, expect, it } from "vitest";
import { simulate, type SimulationInput } from ".";

const input = (conditions: SimulationInput["conditions"], eyepieceMm = 25): SimulationInput => ({
  mode: "eyepiece",
  optics: { apertureMm: 200, focalLengthMm: 1000 },
  eyepiece: { focalLengthMm: eyepieceMm, apparentFovDeg: 52 },
  target: { id: "m42", majorAxisArcsec: 5100, minorAxisArcsec: 3600, category: "nebula" },
  conditions,
});

const lim = (c: SimulationInput["conditions"], e?: number) => simulate(input(c, e)).metrics.limitingMagnitude.value;

describe("engine under real skies", () => {
  it("keeps the dark-site rule when no sky is given (old sessions reproduce)", () => {
    expect(lim({})).toBeCloseTo(2 + 5 * Math.log10(200), 6);
    expect(lim({ seeingArcsec: 2 })).toBeCloseTo(2 + 5 * Math.log10(200), 6);
  });

  it("a pristine sky costs nothing; a city sky costs magnitudes", () => {
    expect(lim({ skyBrightnessMagArcsec2: 21.9 })).toBeCloseTo(lim({}), 6);
    const city = lim({ skyBrightnessMagArcsec2: 17.5 });
    expect(lim({}) - city).toBeGreaterThan(1);
    expect(lim({}) - city).toBeLessThan(4);
  });

  it("higher magnification darkens a bright sky and shows fainter stars", () => {
    expect(lim({ skyBrightnessMagArcsec2: 17.5 }, 6)).toBeGreaterThan(lim({ skyBrightnessMagArcsec2: 17.5 }, 30));
  });

  it("extinction and cloud lower the limit", () => {
    expect(lim({ skyBrightnessMagArcsec2: 21.9, extinctionMag: 0.5 })).toBeCloseTo(lim({}) - 0.5, 6);
    expect(lim({ cloudTransmission: 0.1 })).toBeCloseTo(lim({}) - 2.5, 6);
  });

  it("seeing worsens with air mass", () => {
    const r = simulate(input({ seeingArcsec: 2, airmass: 2 }));
    expect(r.metrics.effectiveSeeing!.value).toBeCloseTo(2 * 2 ** 0.6, 6);
    expect(r.metrics.effectiveResolution!.value).toBeCloseTo(2 * 2 ** 0.6, 6);
  });

  it("warns about the horizon, a bright sky and cloud", () => {
    const codes = (c: SimulationInput["conditions"]) => simulate(input(c)).warnings.map((w) => w.code);
    expect(codes({ targetAltitudeDeg: -5 })).toContain("below_horizon");
    expect(codes({ targetAltitudeDeg: 12 })).toContain("low_altitude");
    expect(codes({ skyBrightnessMagArcsec2: 18 })).toContain("bright_sky");
    expect(codes({ cloudTransmission: 0.2 })).toContain("cloudy");
    expect(codes({ targetAltitudeDeg: 60, skyBrightnessMagArcsec2: 21.5 })).toEqual(expect.not.arrayContaining(["below_horizon", "low_altitude", "bright_sky"]));
  });

  it("reports the sky background at the eyepiece", () => {
    const r = simulate(input({ skyBrightnessMagArcsec2: 18 }, 25));
    if (r.mode !== "eyepiece") throw new Error("mode");
    // 200 mm at 40× → 5 mm exit pupil → (5/7)² darker: +0.73 mag.
    expect(r.metrics.skyBackgroundAtEye!.value).toBeCloseTo(18 + 0.73, 1);
  });
});
