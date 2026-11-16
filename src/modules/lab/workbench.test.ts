import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIGURATION } from "@/modules/configurations/presets";
import { MOUNT_CATALOG } from "@/modules/equipment/catalog";
import {
  BALANCE_TOLERANCE,
  focusOffsetFromError,
  focusTargetMm,
  polarDriftArcsecPerMin,
  polarErrorDeg,
  raBalance,
  trainMassKg,
} from "./workbench";

const heq5 = MOUNT_CATALOG.find((m) => m.id === "skywatcher-heq5-pro")!.spec;
const visual = { mode: "visual" as const, barlow: false, filter: false, top: true };

describe("focus", () => {
  it("needs the drawtube further in for a camera and for a Barlow", () => {
    const eye = focusTargetMm(visual);
    expect(focusTargetMm({ ...visual, mode: "imaging" })).toBeLessThan(eye);
    expect(focusTargetMm({ ...visual, barlow: true })).toBeLessThan(eye);
  });

  it("maps drawtube error to the simulation's focus offset", () => {
    expect(focusOffsetFromError(0)).toBe(0);
    expect(focusOffsetFromError(1)).toBe(0); // inside the sharp zone
    expect(focusOffsetFromError(-15)).toBeCloseTo(0.5);
    expect(focusOffsetFromError(90)).toBe(1);
  });
});

describe("polar alignment", () => {
  it("is zero when latitude and azimuth match", () => {
    expect(polarErrorDeg(51.5, 51.5, 0)).toBe(0);
  });

  it("combines altitude and azimuth errors, azimuth scaled by cos latitude", () => {
    expect(polarErrorDeg(43, 40, 0)).toBeCloseTo(3);
    expect(polarErrorDeg(60, 60, 4)).toBeCloseTo(2); // cos 60° = 0.5
  });

  it("drifts about 15.7″ per minute per degree of error", () => {
    expect(polarDriftArcsecPerMin(1)).toBeCloseTo(15.76, 1);
  });
});

describe("balance", () => {
  it("has a balance point for the default setup on an HEQ5", () => {
    const b = raBalance(DEFAULT_CONFIGURATION, heq5, visual, 0.5);
    expect(b.idealPosition).toBeDefined();
    const at = raBalance(DEFAULT_CONFIGURATION, heq5, visual, b.idealPosition!);
    expect(Math.abs(at.ratio - 1)).toBeLessThan(1e-9);
    expect(at.state).toBe("balanced");
  });

  it("gets lighter on the tube side as the weight slides out", () => {
    const ratios = [0, 0.25, 0.5, 0.75, 1].map((p) => raBalance(DEFAULT_CONFIGURATION, heq5, visual, p).ratio);
    for (let i = 1; i < ratios.length; i++) expect(ratios[i]).toBeLessThan(ratios[i - 1]);
    expect(raBalance(DEFAULT_CONFIGURATION, heq5, visual, 1).state).toBe("weight-heavy");
    expect(BALANCE_TOLERANCE).toBeGreaterThan(0);
  });

  it("uses two counterweights for a 200 mm Newtonian on an HEQ5, as owners do", () => {
    expect(raBalance(DEFAULT_CONFIGURATION, heq5, visual, 0.5).counterweights).toBe(2);
  });

  it("counts a camera as heavier than a 1.25-inch eyepiece", () => {
    const eye = trainMassKg(DEFAULT_CONFIGURATION, visual);
    const cam = trainMassKg(DEFAULT_CONFIGURATION, { ...visual, mode: "imaging" });
    expect(cam).toBeGreaterThan(eye);
  });
});
