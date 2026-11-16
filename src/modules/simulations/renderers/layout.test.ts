import { describe, expect, it } from "vitest";
import { simulate, type SimulationInput } from "@/modules/simulations/engine";
import { computeCameraLayout, computeEyepieceLayout, niceScaleBarArcsec, type CameraResult, type EyepieceResult } from "./layout";

const base = {
  optics: { apertureMm: 200, focalLengthMm: 1000 },
  eyepiece: { focalLengthMm: 25, apparentFovDeg: 50 },
  camera: { sensorWidthMm: 23.5, sensorHeightMm: 15.7, pixelSizeUm: 3.76 },
  conditions: {},
} satisfies Partial<SimulationInput>;

const eyepiece = (target = { id: "moon", majorAxisArcsec: 1866, minorAxisArcsec: 1866 }) =>
  simulate({ ...base, mode: "eyepiece", target }) as EyepieceResult;

const cameraRun = (overrides: Partial<SimulationInput> = {}) =>
  simulate({ ...base, mode: "camera", target: { id: "m42", majorAxisArcsec: 5100, minorAxisArcsec: 3600 }, ...overrides }) as CameraResult;

describe("eyepiece layout", () => {
  it("scales the target by the true field: Moon (1866″) in a 4500″ field", () => {
    const l = computeEyepieceLayout(eyepiece(), 500, { category: "moon", focusOffset: 0 });
    expect(l.fieldRadiusPx).toBeCloseTo(235, 6);
    expect(l.targetMajorPx / (2 * l.fieldRadiusPx)).toBeCloseTo(1866 / 4500, 10);
  });

  it("focus offset adds blur", () => {
    const sharp = computeEyepieceLayout(eyepiece(), 500, { category: "moon", focusOffset: 0 });
    const soft = computeEyepieceLayout(eyepiece(), 500, { category: "moon", focusOffset: 1 });
    expect(soft.blurPx).toBeGreaterThan(sharp.blurPx);
  });

  it("deep-sky objects render dimmer than the Moon", () => {
    const moon = computeEyepieceLayout(eyepiece(), 500, { category: "moon", focusOffset: 0 });
    const galaxy = computeEyepieceLayout(eyepiece(), 500, { category: "galaxy", focusOffset: 0 });
    expect(galaxy.brightness).toBeLessThan(moon.brightness);
  });
});

describe("camera layout", () => {
  it("keeps the sensor aspect ratio", () => {
    const l = computeCameraLayout(cameraRun(), 600, { category: "nebula", zoom: 1, gain: 1 });
    expect(l.displayHeightPx / l.displayWidthPx).toBeCloseTo(53.97 / 80.78, 2);
  });

  it("never renders more pixels than the sensor has across the visible field", () => {
    // Zoom 16: visible width ≈ 4847″/16 ≈ 303″ ≈ 390 sensor px at 0.7756″/px.
    const l = computeCameraLayout(cameraRun(), 800, { category: "nebula", zoom: 16, gain: 1 });
    expect(l.renderWidthPx).toBe(Math.round(4846.9 / 16 / 0.7756));
    expect(l.sensorPixelScreenPx).toBeGreaterThan(2);
  });

  it("longer exposures raise level and lower noise", () => {
    const short = computeCameraLayout(cameraRun({ exposure: { exposureS: 5, gain: 1 } }), 600, { category: "nebula", zoom: 1, gain: 1, exposureS: 5 });
    const long = computeCameraLayout(cameraRun({ exposure: { exposureS: 120, gain: 1 } }), 600, { category: "nebula", zoom: 1, gain: 1, exposureS: 120 });
    expect(long.level).toBeGreaterThan(short.level);
    expect(long.noiseSigma / long.level).toBeLessThan(short.noiseSigma / short.level);
  });

  it("gain brightens without improving the noise-to-signal ratio", () => {
    const g1 = computeCameraLayout(cameraRun({ exposure: { exposureS: 2, gain: 1 } }), 600, { category: "nebula", zoom: 1, gain: 1, exposureS: 2 });
    const g4 = computeCameraLayout(cameraRun({ exposure: { exposureS: 2, gain: 4 } }), 600, { category: "nebula", zoom: 1, gain: 4, exposureS: 2 });
    expect(g4.level).toBeGreaterThan(g1.level);
    expect(g4.noiseSigma / g4.level).toBeCloseTo(g1.noiseSigma / g1.level, 6);
  });
});

describe("scale bar", () => {
  it("picks the largest nice step that fits", () => {
    expect(niceScaleBarArcsec(1000)).toBe(900);
    expect(niceScaleBarArcsec(45)).toBe(30);
    expect(niceScaleBarArcsec(0.5)).toBe(1);
  });
});
