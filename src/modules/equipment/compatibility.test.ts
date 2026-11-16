import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIGURATION } from "@/modules/configurations/presets";
import { checkCompatibility, estimateOtaWeightKg } from "./compatibility";

const ids = (s: Parameters<typeof checkCompatibility>[0]) => checkCompatibility(s).map((n) => `${n.id}:${n.level}`);

describe("compatibility notes", () => {
  it("flags a 2″ eyepiece on a 1.25″-only telescope", () => {
    const spec = {
      ...DEFAULT_CONFIGURATION,
      catalogRef: "celestron-nexstar-8se",
      telescope: { apertureMm: 203, focalLengthMm: 2032, opticalDesign: "catadioptric" as const },
      eyepiece: { focalLengthMm: 30, apparentFovDeg: 82, barrelIn: 2 as const },
    };
    expect(ids(spec)).toContain("eyepiece-barrel:warning");
    expect(ids({ ...spec, catalogRef: "skywatcher-explorer-200p" })).not.toContain("eyepiece-barrel:warning");
  });

  it("flags excessive magnification and an oversized exit pupil", () => {
    const base = { ...DEFAULT_CONFIGURATION, telescope: { apertureMm: 100, focalLengthMm: 1000 } };
    expect(ids({ ...base, eyepiece: { focalLengthMm: 4, apparentFovDeg: 52 } })).toContain("magnification:warning");
    expect(ids({ ...base, eyepiece: { focalLengthMm: 4, apparentFovDeg: 52 }, barlow: undefined })).not.toContain("exit-pupil:warning");
    expect(ids({ ...base, eyepiece: { focalLengthMm: 80, apparentFovDeg: 52 } })).toContain("exit-pupil:warning");
  });

  it("estimates mount loading", () => {
    const heavy = {
      ...DEFAULT_CONFIGURATION,
      catalogRef: undefined,
      telescope: { apertureMm: 300, focalLengthMm: 1500, opticalDesign: "reflector" as const },
      mount: { type: "equatorial" as const, payloadKg: 9 },
    };
    const note = checkCompatibility(heavy).find((n) => n.id === "payload")!;
    expect(note.level).toBe("warning");
    expect(note.kind).toBe("estimated");
    expect(estimateOtaWeightKg({ apertureMm: 80, focalLengthMm: 600, opticalDesign: "refractor" })).toBeCloseTo(2.5, 1);
  });

  it("notes untracked imaging", () => {
    expect(ids({ ...DEFAULT_CONFIGURATION, mount: { type: "dobsonian", tracking: false } })).toContain("tracking:info");
    expect(ids({ ...DEFAULT_CONFIGURATION, camera: undefined, mount: { type: "dobsonian" } })).not.toContain("tracking:info");
  });
});
