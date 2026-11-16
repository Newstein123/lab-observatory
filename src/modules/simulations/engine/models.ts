/**
 * Simulation engine domain types.
 *
 * The engine is pure: it accepts structured inputs and returns versioned,
 * structured results. It must not import React, persistence, data providers
 * or rendering code.
 */

/** How a value was obtained (spec §7). Every displayed value carries one. */
export type Provenance = "calculated" | "retrieved" | "estimated" | "illustrative";

export type SimulationMode = "eyepiece" | "camera";

export type OpticalDesign = "refractor" | "reflector" | "catadioptric";

export interface TelescopeOptics {
  apertureMm: number;
  focalLengthMm: number;
  opticalDesign?: OpticalDesign;
  /** Identification only (e.g. "Celestron NexStar 8SE"); never used in calculations. */
  label?: string;
}

/** Eyepiece / accessory barrel diameter in inches. */
export type BarrelSize = 1.25 | 2;

export interface EyepieceSpec {
  focalLengthMm: number;
  apparentFovDeg: number;
  /** Optional field-stop diameter; enables the more accurate true-FOV formula. */
  fieldStopMm?: number;
  label?: string;
  /** Descriptive only. */
  barrelIn?: BarrelSize;
  eyeReliefMm?: number;
}

export interface CameraSpec {
  sensorWidthMm: number;
  sensorHeightMm: number;
  pixelSizeUm: number;
  resolutionX?: number;
  resolutionY?: number;
  label?: string;
  /** One-shot colour (Bayer) sensor rather than monochrome. Descriptive only. */
  color?: boolean;
}

export interface BarlowSpec {
  factor: number;
  label?: string;
  barrelIn?: BarrelSize;
}

export type FilterKind = "neutral_density" | "uhc" | "oiii" | "light_pollution" | "color_blue" | "color_orange" | "other";

export interface FilterSpec {
  name: string;
  kind?: FilterKind;
}

/** The target's apparent angular extent, as seen from Earth. */
export interface TargetExtent {
  id: string;
  majorAxisArcsec: number;
  minorAxisArcsec: number;
  /** Broad class; selects typical filter transmission. */
  category?: "moon" | "planet" | "nebula" | "galaxy" | "cluster";
  /** J2000 declination, for sidereal drift. Unknown for moving bodies. */
  declinationDeg?: number;
}

export interface ObservingConditions {
  /** Atmospheric seeing, FWHM in arcseconds. */
  seeingArcsec?: number;
}

export interface ExposureSettings {
  exposureS: number;
  /** Relative gain multiplier (1 = unity). Amplifies brightness, not SNR. */
  gain: number;
  /** "none" models an undriven mount (sky drifts during the exposure). Default: tracked. */
  tracking?: TrackingMode;
}

export type TrackingMode = "none" | "sidereal";

export interface SimulationInput {
  mode: SimulationMode;
  optics: TelescopeOptics;
  eyepiece?: EyepieceSpec;
  camera?: CameraSpec;
  barlow?: BarlowSpec;
  filter?: FilterSpec;
  target: TargetExtent;
  conditions: ObservingConditions;
  exposure?: ExposureSettings;
}

export interface Metric {
  value: number;
  unit: string;
  kind: Provenance;
  /** Human-readable formula, shown in the UI for traceability. */
  formula?: string;
  assumptions?: AssumptionId[];
}

export type AssumptionId =
  | "approximate_true_fov"
  | "eye_pupil_7mm"
  | "dawes_point_source"
  | "seeing_dominates_when_larger"
  | "max_useful_magnification_rule"
  | "limiting_magnitude_rule"
  | "shot_noise_only"
  | "barlow_ideal_multiplier"
  | "target_extent_fixed"
  | "filter_transmission_typical"
  | "sidereal_drift_rate"
  | "declination_unknown_equator";

export interface CommonMetrics {
  effectiveFocalLength: Metric;
  focalRatio: Metric;
  dawesLimit: Metric;
  rayleighLimit: Metric;
  effectiveResolution?: Metric;
  lightGatheringVsEye: Metric;
  limitingMagnitude: Metric;
  /** Fraction of the target's light a filter passes (typical value). */
  filterTransmission?: Metric;
}

export interface EyepieceMetrics extends CommonMetrics {
  magnification: Metric;
  exitPupil: Metric;
  trueFov: Metric;
  maxUsefulMagnification: Metric;
  surfaceBrightnessVsEye: Metric;
}

export interface CameraMetrics extends CommonMetrics {
  imageScale: Metric;
  sensorFovWidth: Metric;
  sensorFovHeight: Metric;
  samplingRatio?: Metric;
  relativeExposureIndex?: Metric;
  relativeNoise?: Metric;
  /** Sky drift during an untracked exposure. */
  trailLength?: Metric;
  trailPixels?: Metric;
}

export type WarningCode =
  | "magnification_above_useful_max"
  | "exit_pupil_above_eye_pupil"
  | "exit_pupil_very_small"
  | "target_exceeds_field"
  | "target_very_small_in_field"
  | "seeing_limited"
  | "undersampled"
  | "oversampled"
  | "untracked_trailing";

export interface SimulationWarning {
  code: WarningCode;
  message: string;
}

/** Geometry a renderer needs to frame the target. Angles in arcseconds. */
export type Framing =
  | {
      shape: "circle";
      fieldDiameterArcsec: number;
      targetMajorArcsec: number;
      targetMinorArcsec: number;
      /** Fraction of field diameter covered by the target's major axis. */
      targetFraction: number;
    }
  | {
      shape: "rectangle";
      fieldWidthArcsec: number;
      fieldHeightArcsec: number;
      targetMajorArcsec: number;
      targetMinorArcsec: number;
      targetFraction: number;
    };

interface ResultBase {
  engineVersion: string;
  targetId: string;
  framing: Framing;
  warnings: SimulationWarning[];
  assumptions: AssumptionId[];
}

export type SimulationResult =
  | (ResultBase & { mode: "eyepiece"; metrics: EyepieceMetrics })
  | (ResultBase & { mode: "camera"; metrics: CameraMetrics });
