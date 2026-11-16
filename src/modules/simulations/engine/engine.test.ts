import { describe, expect, it } from "vitest";
import {
  ENGINE_VERSION,
  SimulationInputError,
  camera,
  optics,
  resolution,
  simulate,
  type SimulationInput,
} from "./index";

/**
 * Reference values come from the spec's worked example (§7) and from
 * independent hand calculation. Do not derive expected values from the
 * functions under test.
 */

const SPEC_SCOPE = { apertureMm: 200, focalLengthMm: 1000 };
const JUPITER = { id: "jupiter", majorAxisArcsec: 44, minorAxisArcsec: 41.1 };

const eyepieceInput = (overrides: Partial<SimulationInput> = {}): SimulationInput => ({
  mode: "eyepiece",
  optics: SPEC_SCOPE,
  eyepiece: { focalLengthMm: 25, apparentFovDeg: 50 },
  target: JUPITER,
  conditions: {},
  ...overrides,
});

const cameraInput = (overrides: Partial<SimulationInput> = {}): SimulationInput => ({
  mode: "camera",
  optics: SPEC_SCOPE,
  camera: { sensorWidthMm: 23.5, sensorHeightMm: 15.7, pixelSizeUm: 3.76 },
  target: { id: "m42", majorAxisArcsec: 5100, minorAxisArcsec: 3600 },
  conditions: {},
  ...overrides,
});

describe("spec worked example (200 mm, 1000 mm, 25 mm / 50° eyepiece)", () => {
  it("magnification = 40×", () => {
    expect(optics.magnification(1000, 25)).toBe(40);
  });
  it("exit pupil = 5 mm", () => {
    expect(optics.exitPupil(200, 40)).toBe(5);
  });
  it("Dawes limit ≈ 0.58″", () => {
    expect(resolution.dawesLimit(200)).toBeCloseTo(0.58, 2);
  });
  it("approximate true field = 1.25°", () => {
    expect(optics.trueFovFromApparent(50, 40)).toBeCloseTo(1.25, 10);
  });
  it("image scale for 3.76 µm at 1000 mm ≈ 0.775″/px", () => {
    expect(camera.imageScale(3.76, 1000)).toBeCloseTo(0.7756, 3);
  });
  it("simulate() reproduces the example end to end", () => {
    const r = simulate(eyepieceInput());
    expect(r.mode).toBe("eyepiece");
    if (r.mode !== "eyepiece") return;
    expect(r.metrics.magnification.value).toBe(40);
    expect(r.metrics.exitPupil.value).toBe(5);
    expect(r.metrics.trueFov.value).toBeCloseTo(1.25, 10);
    expect(r.metrics.dawesLimit.value).toBeCloseTo(0.58, 2);
    expect(r.engineVersion).toBe(ENGINE_VERSION);
  });
});

describe("optics", () => {
  it("Barlow multiplies effective focal length and magnification", () => {
    const r = simulate(eyepieceInput({ barlow: { factor: 2 } }));
    if (r.mode !== "eyepiece") throw new Error("expected eyepiece");
    expect(r.metrics.effectiveFocalLength.value).toBe(2000);
    expect(r.metrics.magnification.value).toBe(80);
    expect(r.metrics.exitPupil.value).toBe(2.5);
    expect(r.assumptions).toContain("barlow_ideal_multiplier");
  });

  it("field-stop true field: 21.8 mm at 1000 mm ≈ 1.249°", () => {
    // 21.8 / 1000 rad × 57.29578 = 1.24905°
    expect(optics.trueFovFromFieldStop(21.8, 1000)).toBeCloseTo(1.249, 3);
  });

  it("uses field stop when provided and drops the approximation assumption", () => {
    const r = simulate(eyepieceInput({ eyepiece: { focalLengthMm: 25, apparentFovDeg: 50, fieldStopMm: 21.8 } }));
    if (r.mode !== "eyepiece") throw new Error("expected eyepiece");
    expect(r.metrics.trueFov.value).toBeCloseTo(1.249, 3);
    expect(r.metrics.trueFov.assumptions).toBeUndefined();
    expect(r.assumptions).not.toContain("approximate_true_fov");
  });

  it("focal ratio 1000 / 200 = f/5", () => {
    expect(optics.focalRatio(1000, 200)).toBe(5);
  });

  it("light gathering vs 7 mm eye: (200/7)² ≈ 816.3", () => {
    expect(optics.lightGatheringVsEye(200)).toBeCloseTo(816.33, 2);
  });

  it("limiting magnitude for 200 mm ≈ 13.5", () => {
    // 2 + 5 × log10(200) = 2 + 5 × 2.30103 = 13.505
    expect(optics.limitingMagnitude(200)).toBeCloseTo(13.505, 3);
  });

  it("surface brightness vs eye is capped at 1", () => {
    expect(optics.surfaceBrightnessVsEye(8)).toBe(1);
    expect(optics.surfaceBrightnessVsEye(3.5)).toBeCloseTo(0.25, 10);
  });
});

describe("resolution", () => {
  it("Rayleigh limit for 200 mm ≈ 0.69″", () => {
    expect(resolution.rayleighLimit(200)).toBeCloseTo(0.69, 2);
  });
  it("effective resolution is the larger of optics and seeing", () => {
    expect(resolution.effectiveResolution(0.58, 2)).toBe(2);
    expect(resolution.effectiveResolution(0.58, 0.3)).toBe(0.58);
    expect(resolution.effectiveResolution(0.58)).toBe(0.58);
  });
  it("flags seeing-limited conditions", () => {
    const r = simulate(eyepieceInput({ conditions: { seeingArcsec: 2 } }));
    expect(r.metrics.effectiveResolution?.value).toBe(2);
    expect(r.warnings.map((w) => w.code)).toContain("seeing_limited");
  });
});

describe("camera", () => {
  it("APS-C sensor (23.5 × 15.7 mm) at 1000 mm: ≈ 80.78′ × 53.97′", () => {
    // 2·atan(11.75/1000) = 0.0234989 rad = 80.78′ ; 2·atan(7.85/1000) = 0.0156997 rad = 53.97′
    const r = simulate(cameraInput());
    if (r.mode !== "camera") throw new Error("expected camera");
    expect(r.metrics.sensorFovWidth.value).toBeCloseTo(80.78, 1);
    expect(r.metrics.sensorFovHeight.value).toBeCloseTo(53.97, 1);
    expect(r.metrics.imageScale.value).toBeCloseTo(0.7756, 3);
  });

  it("sampling ratio: 2″ seeing / 0.7756″/px ≈ 2.58 (well sampled)", () => {
    const r = simulate(cameraInput({ conditions: { seeingArcsec: 2 } }));
    if (r.mode !== "camera") throw new Error("expected camera");
    expect(r.metrics.samplingRatio?.value).toBeCloseTo(2.579, 2);
    expect(r.warnings.map((w) => w.code)).not.toContain("undersampled");
    expect(r.warnings.map((w) => w.code)).not.toContain("oversampled");
  });

  it("classifies sampling", () => {
    expect(camera.classifySampling(1.5)).toBe("undersampled");
    expect(camera.classifySampling(2.5)).toBe("well_sampled");
    expect(camera.classifySampling(5)).toBe("oversampled");
  });

  it("relative signal is 1 at the reference setup and scales as expected", () => {
    expect(camera.relativeSignal(1, 3.76, 5)).toBeCloseTo(1, 10);
    expect(camera.relativeSignal(4, 3.76, 5)).toBeCloseTo(4, 10);
    expect(camera.relativeSignal(1, 3.76, 10)).toBeCloseTo(0.25, 10);
    expect(camera.relativeNoise(4)).toBeCloseTo(0.5, 10);
  });

  it("gain raises brightness but not SNR", () => {
    const low = simulate(cameraInput({ exposure: { exposureS: 10, gain: 1 } }));
    const high = simulate(cameraInput({ exposure: { exposureS: 10, gain: 4 } }));
    if (low.mode !== "camera" || high.mode !== "camera") throw new Error("expected camera");
    expect(high.metrics.relativeExposureIndex!.value).toBeCloseTo(4 * low.metrics.relativeExposureIndex!.value, 10);
    expect(high.metrics.relativeNoise!.value).toBeCloseTo(low.metrics.relativeNoise!.value, 10);
    expect(high.metrics.relativeNoise!.kind).toBe("estimated");
  });
});

describe("framing and warnings", () => {
  it("eyepiece framing: Jupiter (44″) in a 1.25° (4500″) field", () => {
    const r = simulate(eyepieceInput());
    expect(r.framing.shape).toBe("circle");
    if (r.framing.shape !== "circle") return;
    expect(r.framing.fieldDiameterArcsec).toBeCloseTo(4500, 6);
    expect(r.framing.targetFraction).toBeCloseTo(44 / 4500, 10);
    expect(r.warnings.map((w) => w.code)).toContain("target_very_small_in_field");
  });

  it("flags a target larger than the camera field (M31 at 1000 mm on APS-C)", () => {
    const r = simulate(cameraInput({ target: { id: "m31", majorAxisArcsec: 11400, minorAxisArcsec: 3600 } }));
    expect(r.warnings.map((w) => w.code)).toContain("target_exceeds_field");
  });

  it("warns on excessive magnification and tiny exit pupil", () => {
    const r = simulate(eyepieceInput({ eyepiece: { focalLengthMm: 2, apparentFovDeg: 50 }, barlow: { factor: 3 } }));
    // M = 3000 / 2 = 1500× > 400× ; exit pupil = 200/1500 = 0.133 mm
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toContain("magnification_above_useful_max");
    expect(codes).toContain("exit_pupil_very_small");
  });

  it("warns when exit pupil exceeds the eye pupil", () => {
    const r = simulate(eyepieceInput({ eyepiece: { focalLengthMm: 40, apparentFovDeg: 50 } }));
    // M = 25×, exit pupil = 8 mm
    expect(r.warnings.map((w) => w.code)).toContain("exit_pupil_above_eye_pupil");
  });
});

describe("provenance labelling", () => {
  it("labels direct formulas as calculated and rules of thumb as estimated", () => {
    const r = simulate(eyepieceInput());
    if (r.mode !== "eyepiece") throw new Error("expected eyepiece");
    expect(r.metrics.magnification.kind).toBe("calculated");
    expect(r.metrics.exitPupil.kind).toBe("calculated");
    expect(r.metrics.dawesLimit.kind).toBe("estimated");
    expect(r.metrics.maxUsefulMagnification.kind).toBe("estimated");
    for (const m of Object.values(r.metrics)) {
      expect(m.formula, "every metric documents its formula").toBeTruthy();
    }
  });
});

describe("determinism", () => {
  it("same input yields identical output", () => {
    const input = eyepieceInput({ conditions: { seeingArcsec: 1.5 }, barlow: { factor: 2 } });
    expect(simulate(input)).toEqual(simulate(structuredClone(input)));
  });
});

describe("validation", () => {
  it("rejects eyepiece mode without an eyepiece", () => {
    expect(() => simulate(eyepieceInput({ eyepiece: undefined }))).toThrow(SimulationInputError);
  });
  it("rejects camera mode without a camera", () => {
    expect(() => simulate(cameraInput({ camera: undefined }))).toThrow(SimulationInputError);
  });
  it.each([
    ["zero aperture", { optics: { apertureMm: 0, focalLengthMm: 1000 } }],
    ["negative focal length", { optics: { apertureMm: 200, focalLengthMm: -5 } }],
    ["NaN aperture", { optics: { apertureMm: Number.NaN, focalLengthMm: 1000 } }],
    ["Infinity focal length", { optics: { apertureMm: 200, focalLengthMm: Infinity } }],
    ["Barlow below 1", { barlow: { factor: 0.5 } }],
    ["absurd seeing", { conditions: { seeingArcsec: 100 } }],
  ])("rejects %s", (_name, overrides) => {
    expect(() => simulate(eyepieceInput(overrides as Partial<SimulationInput>))).toThrow(SimulationInputError);
  });
  it("reports the offending path", () => {
    try {
      simulate(eyepieceInput({ optics: { apertureMm: 0, focalLengthMm: 1000 } }));
      expect.unreachable();
    } catch (e) {
      expect((e as SimulationInputError).issues[0].path).toBe("optics.apertureMm");
    }
  });
});

describe("engine 1.1: filters and untracked drift", () => {
  const optics = { apertureMm: 200, focalLengthMm: 1000 };
  const camera = { sensorWidthMm: 23.5, sensorHeightMm: 15.7, pixelSizeUm: 3.76 };
  const m42 = { id: "m42", majorAxisArcsec: 3900, minorAxisArcsec: 3600, category: "nebula" as const, declinationDeg: -5.39 };
  const moon = { id: "moon", majorAxisArcsec: 1865, minorAxisArcsec: 1865, category: "moon" as const };

  it("reports typical filter transmission by target class (estimated)", () => {
    const run = (target: typeof m42 | typeof moon) =>
      simulate({ mode: "eyepiece", optics, eyepiece: { focalLengthMm: 25, apparentFovDeg: 50 }, filter: { name: "UHC", kind: "uhc" }, target, conditions: {} });
    const nebula = run(m42).metrics.filterTransmission!;
    expect(nebula.kind).toBe("estimated");
    expect(nebula.value).toBeGreaterThan(run(moon).metrics.filterTransmission!.value);
    expect(run(m42).assumptions).toContain("filter_transmission_typical");
  });

  it("filters without a type add no metric", () => {
    const r = simulate({ mode: "eyepiece", optics, eyepiece: { focalLengthMm: 25, apparentFovDeg: 50 }, filter: { name: "Mystery" }, target: m42, conditions: {} });
    expect(r.metrics.filterTransmission).toBeUndefined();
  });

  it("computes sky drift for an untracked exposure", () => {
    const r = simulate({ mode: "camera", optics, camera, target: m42, conditions: {}, exposure: { exposureS: 10, gain: 1, tracking: "none" } });
    if (r.mode !== "camera") throw new Error("camera expected");
    // 15.041″/s × cos(−5.39°) × 10 s ≈ 149.7″; image scale 0.7756″/px → ≈ 193 px.
    expect(r.metrics.trailLength!.value).toBeCloseTo(149.75, 1);
    expect(r.metrics.trailPixels!.value).toBeCloseTo(149.75 / 0.77556, 0);
    expect(r.metrics.trailLength!.kind).toBe("calculated");
    expect(r.warnings.map((w) => w.code)).toContain("untracked_trailing");
  });

  it("assumes the equator when a target's declination is unknown, and nothing when tracked", () => {
    const untracked = simulate({ mode: "camera", optics, camera, target: moon, conditions: {}, exposure: { exposureS: 1, gain: 1, tracking: "none" } });
    if (untracked.mode !== "camera") throw new Error("camera expected");
    expect(untracked.metrics.trailLength!.value).toBeCloseTo(15.041, 3);
    expect(untracked.assumptions).toContain("declination_unknown_equator");
    const tracked = simulate({ mode: "camera", optics, camera, target: moon, conditions: {}, exposure: { exposureS: 1, gain: 1 } });
    if (tracked.mode !== "camera") throw new Error("camera expected");
    expect(tracked.metrics.trailLength).toBeUndefined();
  });
});
