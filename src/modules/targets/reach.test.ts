import { describe, expect, it } from "vitest";
import type { ConfigurationSpec } from "@/modules/configurations/models";
import { DEFAULT_CONFIGURATION } from "@/modules/configurations/presets";
import { getTelescopeEntry } from "@/modules/equipment/catalog";
import { assessReach } from "./reach";
import { getTarget, surfaceBrightness, TARGETS } from "./catalogue";

const t = (id: string) => getTarget(id)!;
const reach = (id: string, spec: ConfigurationSpec, mode: "eyepiece" | "camera" = "eyepiece") => assessReach(t(id), spec, mode).reach;

describe("target catalogue", () => {
  it("has 30 targets with unique ids and sane values", () => {
    expect(TARGETS).toHaveLength(30);
    expect(new Set(TARGETS.map((x) => x.id)).size).toBe(30);
    for (const x of TARGETS) {
      expect(x.angularSize.majorAxisArcsec, x.id).toBeGreaterThanOrEqual(x.angularSize.minorAxisArcsec);
      expect(x.suggestedExposureS, x.id).toBeGreaterThan(0);
      if (x.category !== "moon" && x.category !== "planet") expect(x.coordinatesJ2000, x.id).toBeDefined();
    }
  });

  it("computes mean surface brightness", () => {
    // M31: 3.4 + 2.5·log10(π/4 · 11400″ · 3600″) ≈ 22.2
    expect(surfaceBrightness(t("m31"))).toBeCloseTo(22.17, 1);
  });
});

describe("reach (estimated)", () => {
  const dob200 = DEFAULT_CONFIGURATION; // 200 mm f/5, 25 mm eyepiece, APS-C camera

  it("a 200 mm telescope reaches every target by eye; faint ones are challenging", () => {
    for (const x of TARGETS) expect(reach(x.id, dob200), x.id).not.toBe("out_of_reach");
    expect(reach("jupiter", dob200)).toBe("good");
    expect(reach("m101", dob200)).toBe("challenging"); // low surface brightness
    expect(reach("m33", dob200)).toBe("challenging");
  });

  it("a small aperture cannot show faint objects", () => {
    const tiny = { ...dob200, telescope: { apertureMm: 30, focalLengthMm: 300, opticalDesign: "refractor" as const } };
    expect(reach("m57", tiny)).toBe("out_of_reach"); // mag 8.8 vs limit ≈ 9.4
    expect(reach("m45", tiny)).not.toBe("out_of_reach");
  });

  it("in camera mode, tiny planets are out of reach at short focal length", () => {
    expect(reach("neptune", dob200, "camera")).toBe("out_of_reach");
    expect(reach("uranus", dob200, "camera")).toBe("out_of_reach");
    expect(reach("jupiter", dob200, "camera")).toBe("good");
    const sct = getTelescopeEntry("celestron-c11")!;
    const planetary = { ...dob200, telescope: sct.optics, barlow: { factor: 2.5 }, camera: { sensorWidthMm: 5.61, sensorHeightMm: 3.18, pixelSizeUm: 2.9 } };
    expect(reach("uranus", planetary, "camera")).not.toBe("out_of_reach");
  });

  it("charges extinction once: hazy air acts like a fainter target, not twice", () => {
    // A small cluster near the faint limit of a 60 mm under a suburban sky.
    const tiny = { ...dob200, telescope: { ...dob200.telescope, apertureMm: 60, focalLengthMm: 700 } };
    const sky = { skyMag: 19.5, altitudeDeg: 30 };
    for (let m = 6; m <= 13; m += 0.25) {
      const base = { ...t("m13"), magnitude: m };
      const hazy = assessReach(base, tiny, "eyepiece", { ...sky, extinctionMag: 1.5 });
      const fainter = assessReach({ ...base, magnitude: m + 1.5 }, tiny, "eyepiece", sky);
      expect(hazy.reach, `mag ${m}`).toBe(fainter.reach);
    }
  });

  it("flags targets larger than the field, with reasons", () => {
    const r = assessReach(t("m31"), dob200, "eyepiece");
    expect(r.reach).toBe("challenging");
    expect(r.reasons.join(" ")).toMatch(/only part fits/);
  });

  it("says whether the sky or the setup is to blame", () => {
    // Below the horizon: the sky, not the telescope.
    const down = assessReach(t("jupiter"), dob200, "eyepiece", { skyMag: 21, altitudeDeg: -10 });
    expect(down).toMatchObject({ reach: "out_of_reach", cause: "sky" });
    // Too faint for a tiny aperture, high in a dark sky: the setup.
    const tiny = { ...dob200, telescope: { apertureMm: 30, focalLengthMm: 300, opticalDesign: "refractor" as const } };
    expect(assessReach(t("m57"), tiny, "eyepiece", { skyMag: 21.5, altitudeDeg: 60 })).toMatchObject({ reach: "out_of_reach", cause: "setup" });
    // Nothing wrong: no cause.
    expect(assessReach(t("jupiter"), dob200, "eyepiece", { skyMag: 21, altitudeDeg: 50 }).cause).toBeUndefined();
  });
});
