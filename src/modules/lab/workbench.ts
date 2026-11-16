/**
 * Calculations behind the telescope workbench: focusing, polar alignment and
 * balance. Pure functions; each result says how it was obtained.
 */
import { cameraTrainDims, equatorialArms, eyepieceDimensions, otaDimensions } from "@/components/equipment-3d/dimensions";
import type { ConfigurationSpec } from "@/modules/configurations/models";
import { estimateOtaWeightKg } from "@/modules/equipment/compatibility";
import type { MountSpec } from "@/modules/equipment/models";

export type TrainMode = "visual" | "imaging";

export interface TrainParts {
  mode: TrainMode;
  barlow: boolean;
  filter: boolean;
  /** An eyepiece (visual) or camera (imaging) is in the focuser. */
  top: boolean;
}

/**
 * Drawtube extension (mm) at which this train comes to focus (ILLUSTRATIVE:
 * representative, not a specific focuser). A camera's sensor sits deeper than
 * an eyepiece's focal plane, so imaging needs the drawtube racked further in;
 * a Barlow lifts the eyepiece higher, so it too needs inward travel.
 */
export function focusTargetMm(train: TrainParts): number {
  let target = train.mode === "imaging" ? 14 : 34;
  if (train.barlow) target -= 9;
  if (train.filter) target += 1;
  return Math.min(55, Math.max(5, target));
}

/** Within this many mm of focus the star looks sharp. */
export const FOCUS_TOLERANCE_MM = 1.2;

/** Drawtube error (mm) → the simulation's focus offset (0 = sharp, 1 = far out). */
export function focusOffsetFromError(errorMm: number): number {
  // Within the sharp zone the simulation shows a perfectly focused view.
  if (Math.abs(errorMm) <= FOCUS_TOLERANCE_MM) return 0;
  return Math.min(1, Math.abs(errorMm) / 30);
}

/** Inverse of `focusOffsetFromError`, choosing the outward side. */
export function errorFromFocusOffset(offset: number): number {
  return Math.min(1, Math.max(0, offset)) * 30;
}


/**
 * Polar-alignment error, degrees (CALCULATED): the angle between the mount's
 * polar axis and the celestial pole, from the latitude setting's error and
 * the azimuth error (which shrinks by cos latitude near the zenith).
 */
export function polarErrorDeg(latitudeSettingDeg: number, siteLatitudeDeg: number, azimuthErrorDeg: number): number {
  const alt = latitudeSettingDeg - siteLatitudeDeg;
  const az = azimuthErrorDeg * Math.cos((siteLatitudeDeg * Math.PI) / 180);
  return Math.hypot(alt, az);
}

/** Earth's sidereal rotation, radians per second. */
const SIDEREAL_RAD_PER_S = (2 * Math.PI) / 86_164.0905;

/**
 * Worst-case star drift caused by a polar-alignment error, arcsec per minute
 * (CALCULATED): the field rotates about the mount's axis instead of the
 * celestial pole, so stars move by up to error × sidereal rate.
 */
export function polarDriftArcsecPerMin(errorDeg: number): number {
  return errorDeg * 3600 * SIDEREAL_RAD_PER_S * 60;
}

/** Polar alignment good enough for visual use and short exposures (estimate). */
export const POLAR_OK_DEG = 0.5;

/** Typical accessory masses, kg (ESTIMATED from common products). */
export function trainMassKg(spec: ConfigurationSpec, train: TrainParts): number {
  let kg = 0;
  if (train.top && train.mode === "visual" && spec.eyepiece) {
    const d = eyepieceDimensions(spec.eyepiece);
    kg += spec.eyepiece.barrelIn === 2 ? 0.55 : 0.12 + d.bodyR * 0.006;
  }
  if (train.top && train.mode === "imaging" && spec.camera) {
    const kind = cameraTrainDims(spec.camera).kind;
    kg += kind === "fullframe" ? 0.7 : kind === "cooled" ? 0.75 : 0.12;
  }
  if (train.barlow && spec.barlow) kg += spec.barlow.barrelIn === 2 ? 0.35 : 0.15;
  if (train.filter && spec.filter) kg += 0.02;
  return kg;
}

/** One counterweight for a mount of this size, kg (ESTIMATED from typical mounts). */
export function counterweightUnitKg(mount: MountSpec): number {
  return (mount.payloadKg ?? 8) >= 15 ? 5 : (mount.payloadKg ?? 8) >= 10 ? 5.1 : 3.4;
}

export type BalanceState = "tube-heavy" | "balanced" | "weight-heavy";

export interface Balance {
  /** Tube-side torque ÷ counterweight torque. 1 = balanced. */
  ratio: number;
  state: BalanceState;
  tubeSideKg: number;
  /** Number of counterweights on the shaft, and their total mass. */
  counterweights: number;
  counterweightKg: number;
  /** Slider position (0…1) that would balance, if reachable. */
  idealPosition?: number;
}

/** Within ±this fraction of perfect balance counts as balanced. */
export const BALANCE_TOLERANCE = 0.06;

/**
 * Right-ascension balance with the counterweight shaft horizontal
 * (ESTIMATED: tube and accessory masses are typical values).
 */
export function raBalance(spec: ConfigurationSpec, mount: MountSpec, train: TrainParts, counterweightPosition: number): Balance {
  const arms = equatorialArms(mount.payloadKg, otaDimensions(spec.telescope).radius);
  const tubeSideKg = estimateOtaWeightKg(spec.telescope) + trainMassKg(spec, train);
  const unit = counterweightUnitKg(mount);
  // As an owner would: add weights until the balance point is on the shaft (up to 3).
  const tubeTorque = tubeSideKg * arms.tubeArmMm;
  let counterweights = 1;
  while (counterweights < 3 && tubeTorque / (unit * counterweights) > arms.counterweightMm(0.9)) counterweights++;
  const cwKg = unit * counterweights;
  const ratio = (tubeSideKg * arms.tubeArmMm) / (cwKg * arms.counterweightMm(counterweightPosition));
  const state: BalanceState = ratio > 1 + BALANCE_TOLERANCE ? "tube-heavy" : ratio < 1 - BALANCE_TOLERANCE ? "weight-heavy" : "balanced";
  // Solve tube torque = cw torque for the position.
  const neededMm = (tubeSideKg * arms.tubeArmMm) / cwKg;
  const lo = arms.counterweightMm(0);
  const hi = arms.counterweightMm(1);
  const idealPosition = neededMm >= lo && neededMm <= hi ? (neededMm - lo) / (hi - lo) : undefined;
  return { ratio, state, tubeSideKg, counterweights, counterweightKg: cwKg, idealPosition };
}
