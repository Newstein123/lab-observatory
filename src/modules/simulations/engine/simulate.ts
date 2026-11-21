import { ARCSEC_PER_DEGREE, ENGINE_VERSION, EYE_PUPIL_MM, SIDEREAL_RATE_ARCSEC_PER_S } from "./constants";
import { filterTransmission } from "./filters";
import {
  effectiveFocalLength,
  exitPupil,
  focalRatio,
  lightGatheringVsEye,
  limitingMagnitude,
  magnification,
  maxUsefulMagnification,
  skyBackgroundAtEye,
  skyLimitedMagnitude,
  surfaceBrightnessVsEye,
  trueFovFromApparent,
  trueFovFromFieldStop,
} from "./optics";
import { dawesLimit, effectiveResolution, rayleighLimit } from "./resolution";
import {
  classifySampling,
  imageScale,
  relativeExposureIndex,
  relativeNoise,
  relativeSignal,
  samplingRatio,
  sensorFovArcsec,
} from "./camera";
import type {
  AssumptionId,
  CameraMetrics,
  CommonMetrics,
  EyepieceMetrics,
  Framing,
  Metric,
  SimulationInput,
  SimulationResult,
  SimulationWarning,
} from "./models";
import { simulationInputSchema } from "./validation";

/** Below this fraction of the field, the target is flagged as very small. */
const SMALL_TARGET_FRACTION = 0.02;

export class SimulationInputError extends Error {
  constructor(public readonly issues: { path: string; message: string }[]) {
    super(`Invalid simulation input: ${issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`);
    this.name = "SimulationInputError";
  }
}

const calculated = (value: number, unit: string, formula: string, assumptions?: AssumptionId[]): Metric => ({
  value,
  unit,
  kind: "calculated",
  formula,
  ...(assumptions?.length ? { assumptions } : {}),
});

const estimated = (value: number, unit: string, formula: string, assumptions: AssumptionId[]): Metric => ({
  value,
  unit,
  kind: "estimated",
  formula,
  assumptions,
});

/**
 * Run a deterministic simulation. Validates input and throws
 * SimulationInputError on invalid values. Pure: same input → same output.
 */
export function simulate(rawInput: SimulationInput): SimulationResult {
  const parsed = simulationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new SimulationInputError(
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  const input = parsed.data as SimulationInput;
  const { optics, barlow, target, conditions } = input;

  const assumptions = new Set<AssumptionId>(["target_extent_fixed"]);
  const warnings: SimulationWarning[] = [];

  const barlowFactor = barlow?.factor ?? 1;
  if (barlow) assumptions.add("barlow_ideal_multiplier");
  const efl = effectiveFocalLength(optics.focalLengthMm, barlowFactor);
  const dawes = dawesLimit(optics.apertureMm);
  // Seeing along the line of sight: worse through more air.
  const seeing =
    conditions.seeingArcsec !== undefined && conditions.airmass !== undefined
      ? conditions.seeingArcsec * conditions.airmass ** 0.6
      : conditions.seeingArcsec;
  const skyGiven =
    conditions.skyBrightnessMagArcsec2 !== undefined || conditions.extinctionMag !== undefined || conditions.cloudTransmission !== undefined;

  /** Limiting magnitude for an exit pupil, under this sky. */
  const limitFor = (pupilMm: number): Metric => {
    if (!skyGiven) {
      return estimated(limitingMagnitude(optics.apertureMm), "mag", "2 + 5·log₁₀(D mm)", ["limiting_magnitude_rule"]);
    }
    const sky = conditions.skyBrightnessMagArcsec2;
    let v = sky !== undefined ? skyLimitedMagnitude(optics.apertureMm, sky, pupilMm) : limitingMagnitude(optics.apertureMm);
    v -= conditions.extinctionMag ?? 0;
    if (conditions.cloudTransmission !== undefined) v += 2.5 * Math.log10(Math.max(conditions.cloudTransmission, 0.01));
    const used: AssumptionId[] = ["limiting_magnitude_rule"];
    const terms = ["2 + 5·log₁₀(D)"];
    if (sky !== undefined) {
      used.push("sky_limited_magnitude");
      terms.push("sky penalty");
    }
    if (conditions.extinctionMag !== undefined) {
      used.push("extinction_airmass");
      terms.push("extinction");
    }
    if (conditions.cloudTransmission !== undefined) used.push("cloud_transmission");
    const formula = terms.join(" − ") + (conditions.cloudTransmission !== undefined ? " + 2.5·log₁₀(cloud)" : "");
    return estimated(v, "mag", formula, used);
  };

  const common: CommonMetrics = {
    effectiveFocalLength: calculated(
      efl,
      "mm",
      "F_eff = F_t × Barlow factor",
      barlow ? ["barlow_ideal_multiplier"] : undefined,
    ),
    focalRatio: calculated(focalRatio(efl, optics.apertureMm), "", "N = F_eff / D"),
    dawesLimit: estimated(dawes, "arcsec", "θ ≈ 116 / D(mm)", ["dawes_point_source"]),
    rayleighLimit: estimated(rayleighLimit(optics.apertureMm), "arcsec", "θ ≈ 138 / D(mm)", [
      "dawes_point_source",
    ]),
    lightGatheringVsEye: calculated(
      lightGatheringVsEye(optics.apertureMm),
      "×",
      `(D / ${EYE_PUPIL_MM} mm)²`,
      ["eye_pupil_7mm"],
    ),
    limitingMagnitude: limitFor(EYE_PUPIL_MM),
  };
  assumptions.add("dawes_point_source");
  assumptions.add("eye_pupil_7mm");
  for (const a of common.limitingMagnitude.assumptions ?? []) assumptions.add(a);

  // --- Atmosphere ---
  if (conditions.airmass !== undefined) {
    common.airmass = calculated(conditions.airmass, "", "Kasten & Young (1989)");
    if (seeing !== undefined) {
      common.effectiveSeeing = estimated(seeing, "arcsec", "seeing × air mass^0.6", ["seeing_airmass"]);
      assumptions.add("seeing_airmass");
    }
  }
  if (conditions.extinctionMag !== undefined) {
    common.extinction = estimated(conditions.extinctionMag, "mag", "k × air mass", ["extinction_airmass"]);
    assumptions.add("extinction_airmass");
  }
  if (conditions.skyBrightnessMagArcsec2 !== undefined) {
    common.skyBrightness = estimated(conditions.skyBrightnessMagArcsec2, "mag/arcsec²", "light pollution + airglow + moonlight + twilight", [
      "sky_brightness_estimated",
    ]);
    assumptions.add("sky_brightness_estimated");
    if (conditions.skyBrightnessMagArcsec2 < 19.5) {
      warnings.push({
        code: "bright_sky",
        message: `Bright sky (${conditions.skyBrightnessMagArcsec2.toFixed(1)} mag/arcsec²): faint nebulae and galaxies lose contrast or vanish.`,
      });
    }
  }
  if (conditions.cloudTransmission !== undefined) {
    common.cloudTransmission = estimated(conditions.cloudTransmission, "", "1 − 0.95 × cloud cover", ["cloud_transmission"]);
    assumptions.add("cloud_transmission");
    if (conditions.cloudTransmission < 0.5) {
      warnings.push({ code: "cloudy", message: "Cloud blocks much of the light; expect gaps and fading." });
    }
  }
  if (conditions.targetAltitudeDeg !== undefined) {
    if (conditions.targetAltitudeDeg < 0) {
      warnings.push({ code: "below_horizon", message: "The target is below the horizon at this time and place." });
    } else if (conditions.targetAltitudeDeg < 20) {
      warnings.push({
        code: "low_altitude",
        message: `Only ${conditions.targetAltitudeDeg.toFixed(0)}° above the horizon: looking through thick air blurs and dims the view.`,
      });
    }
  }

  if (input.filter?.kind && input.filter.kind !== "other") {
    common.filterTransmission = estimated(
      filterTransmission(input.filter.kind, target.category),
      "",
      "typical transmission for filter type × target class",
      ["filter_transmission_typical"],
    );
    assumptions.add("filter_transmission_typical");
  }

  if (seeing !== undefined) {
    common.effectiveResolution = estimated(
      effectiveResolution(dawes, seeing),
      "arcsec",
      "max(Dawes limit, seeing)",
      ["seeing_dominates_when_larger", "dawes_point_source"],
    );
    assumptions.add("seeing_dominates_when_larger");
    if (seeing > dawes) {
      warnings.push({
        code: "seeing_limited",
        message: `Seeing (${seeing.toFixed(1)}″) is worse than the optical limit (${dawes.toFixed(2)}″); the atmosphere limits detail.`,
      });
    }
  }

  const finish = (framing: Framing): Omit<SimulationResult, "mode" | "metrics"> => {
    if (framing.targetFraction > 1) {
      warnings.push({ code: "target_exceeds_field", message: "The target is larger than the field of view." });
    } else if (framing.targetFraction < SMALL_TARGET_FRACTION) {
      warnings.push({
        code: "target_very_small_in_field",
        message: "The target covers less than 2% of the field of view.",
      });
    }
    return {
      engineVersion: ENGINE_VERSION,
      targetId: target.id,
      framing,
      warnings,
      assumptions: [...assumptions].sort(),
    };
  };

  if (input.mode === "eyepiece") {
    const eyepiece = input.eyepiece!;
    const mag = magnification(efl, eyepiece.focalLengthMm);
    const pupil = exitPupil(optics.apertureMm, mag);
    const maxMag = maxUsefulMagnification(optics.apertureMm);

    const trueFov =
      eyepiece.fieldStopMm !== undefined
        ? calculated(trueFovFromFieldStop(eyepiece.fieldStopMm, efl), "deg", "TFOV = field stop / F_eff (rad)")
        : calculated(trueFovFromApparent(eyepiece.apparentFovDeg, mag), "deg", "TFOV ≈ AFOV / M", [
            "approximate_true_fov",
          ]);
    if (eyepiece.fieldStopMm === undefined) assumptions.add("approximate_true_fov");
    assumptions.add("max_useful_magnification_rule");

    if (mag > maxMag) {
      warnings.push({
        code: "magnification_above_useful_max",
        message: `Magnification ${mag.toFixed(0)}× exceeds the ~${maxMag.toFixed(0)}× useful maximum for this aperture.`,
      });
    }
    if (pupil > EYE_PUPIL_MM) {
      warnings.push({
        code: "exit_pupil_above_eye_pupil",
        message: `Exit pupil ${pupil.toFixed(1)} mm is larger than a ${EYE_PUPIL_MM} mm eye pupil; some light is wasted.`,
      });
    } else if (pupil < 0.5) {
      warnings.push({
        code: "exit_pupil_very_small",
        message: `Exit pupil ${pupil.toFixed(2)} mm is very small; the image will be dim and floaters visible.`,
      });
    }

    const metrics: EyepieceMetrics = {
      ...common,
      magnification: calculated(mag, "×", "M = F_eff / F_e"),
      exitPupil: calculated(pupil, "mm", "P = D / M"),
      trueFov,
      maxUsefulMagnification: estimated(maxMag, "×", "2 × D(mm)", ["max_useful_magnification_rule"]),
      surfaceBrightnessVsEye: estimated(
        surfaceBrightnessVsEye(pupil),
        "×",
        `min(1, (P / ${EYE_PUPIL_MM} mm)²)`,
        ["eye_pupil_7mm"],
      ),
      // A smaller exit pupil darkens the sky background, so stars show better.
      limitingMagnitude: limitFor(pupil),
    };
    if (conditions.skyBrightnessMagArcsec2 !== undefined) {
      metrics.skyBackgroundAtEye = estimated(
        skyBackgroundAtEye(conditions.skyBrightnessMagArcsec2, pupil),
        "mag/arcsec²",
        `sky − 2.5·log₁₀(min(1, (P / ${EYE_PUPIL_MM} mm)²))`,
        ["sky_brightness_estimated", "eye_pupil_7mm"],
      );
    }

    const fieldDiameterArcsec = trueFov.value * ARCSEC_PER_DEGREE;
    const framing: Framing = {
      shape: "circle",
      fieldDiameterArcsec,
      targetMajorArcsec: target.majorAxisArcsec,
      targetMinorArcsec: target.minorAxisArcsec,
      targetFraction: target.majorAxisArcsec / fieldDiameterArcsec,
    };
    return { mode: "eyepiece", metrics, ...finish(framing) };
  }

  // Camera mode
  const camera = input.camera!;
  const scale = imageScale(camera.pixelSizeUm, efl);
  const fovW = sensorFovArcsec(camera.sensorWidthMm, efl);
  const fovH = sensorFovArcsec(camera.sensorHeightMm, efl);
  const fRatio = focalRatio(efl, optics.apertureMm);

  const metrics: CameraMetrics = {
    ...common,
    imageScale: calculated(scale, "arcsec/px", "206.265 × pixel(µm) / F_eff(mm)"),
    sensorFovWidth: calculated(fovW / 60, "arcmin", "2·atan(w / 2F_eff)"),
    sensorFovHeight: calculated(fovH / 60, "arcmin", "2·atan(h / 2F_eff)"),
  };

  if (seeing !== undefined) {
    const ratio = samplingRatio(seeing, scale);
    metrics.samplingRatio = calculated(ratio, "px/FWHM", "seeing / image scale");
    const cls = classifySampling(ratio);
    if (cls === "undersampled") {
      warnings.push({
        code: "undersampled",
        message: `Only ${ratio.toFixed(1)} px across the seeing disc; stars may look blocky (≈2–3.5 is typical).`,
      });
    } else if (cls === "oversampled") {
      warnings.push({
        code: "oversampled",
        message: `${ratio.toFixed(1)} px across the seeing disc; resolution is limited by seeing, not pixels (≈2–3.5 is typical).`,
      });
    }
  }

  if (input.exposure) {
    const signal = relativeSignal(input.exposure.exposureS, camera.pixelSizeUm, fRatio);
    metrics.relativeExposureIndex = estimated(
      relativeExposureIndex(signal, input.exposure.gain),
      "× ref",
      "t × gain × (pixel / 3.76 µm)² × (5 / N)²",
      ["shot_noise_only"],
    );
    metrics.relativeNoise = estimated(relativeNoise(signal), "× ref", "1 / √(relative signal)", [
      "shot_noise_only",
    ]);
    assumptions.add("shot_noise_only");

    if (input.exposure.tracking === "none") {
      const decKnown = target.declinationDeg !== undefined;
      const cosDec = Math.cos(((target.declinationDeg ?? 0) * Math.PI) / 180);
      const trail = SIDEREAL_RATE_ARCSEC_PER_S * cosDec * input.exposure.exposureS;
      const used: AssumptionId[] = decKnown ? ["sidereal_drift_rate"] : ["sidereal_drift_rate", "declination_unknown_equator"];
      used.forEach((a) => assumptions.add(a));
      metrics.trailLength = calculated(trail, "arcsec", "15.04″/s × cos δ × t", used);
      metrics.trailPixels = calculated(trail / scale, "px", "trail / image scale", used);
      if (trail / scale > 1) {
        warnings.push({
          code: "untracked_trailing",
          message: `Without tracking the sky drifts ${(trail / scale).toFixed(trail / scale < 10 ? 1 : 0)} px during this exposure; the target will be smeared.`,
        });
      }
    }
  }

  const framing: Framing = {
    shape: "rectangle",
    fieldWidthArcsec: fovW,
    fieldHeightArcsec: fovH,
    targetMajorArcsec: target.majorAxisArcsec,
    targetMinorArcsec: target.minorAxisArcsec,
    targetFraction: Math.max(
      target.majorAxisArcsec / Math.max(fovW, fovH),
      target.minorAxisArcsec / Math.min(fovW, fovH),
    ),
  };
  return { mode: "camera", metrics, ...finish(framing) };
}
