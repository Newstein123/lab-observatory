import { ARCSEC_PER_RADIAN, EYE_PUPIL_MM } from "./constants";

/** Telescope focal length after any Barlow amplification (mm). */
export function effectiveFocalLength(focalLengthMm: number, barlowFactor = 1): number {
  return focalLengthMm * barlowFactor;
}

/** Focal ratio N = F / D (unitless). */
export function focalRatio(focalLengthMm: number, apertureMm: number): number {
  return focalLengthMm / apertureMm;
}

/** Magnification M = Ft / Fe. */
export function magnification(telescopeFocalLengthMm: number, eyepieceFocalLengthMm: number): number {
  return telescopeFocalLengthMm / eyepieceFocalLengthMm;
}

/** Exit pupil P = D / M (mm). */
export function exitPupil(apertureMm: number, mag: number): number {
  return apertureMm / mag;
}

/** Approximate true field TFOV ≈ AFOV / M (degrees). */
export function trueFovFromApparent(apparentFovDeg: number, mag: number): number {
  return apparentFovDeg / mag;
}

/**
 * True field from the eyepiece field stop: TFOV = field stop / Ft (radians),
 * returned in degrees. More accurate than the AFOV approximation.
 */
export function trueFovFromFieldStop(fieldStopMm: number, telescopeFocalLengthMm: number): number {
  return ((fieldStopMm / telescopeFocalLengthMm) * ARCSEC_PER_RADIAN) / 3600;
}

/** Rule-of-thumb maximum useful magnification: 2 × aperture (mm). */
export function maxUsefulMagnification(apertureMm: number): number {
  return 2 * apertureMm;
}

/** Light-gathering area relative to the dark-adapted eye: (D / pupil)². */
export function lightGatheringVsEye(apertureMm: number, eyePupilMm = EYE_PUPIL_MM): number {
  return (apertureMm / eyePupilMm) ** 2;
}

/**
 * Surface brightness of an extended object relative to the naked eye:
 * (exit pupil / eye pupil)², capped at 1. A telescope cannot make an
 * extended object appear brighter per unit area than the naked eye sees it.
 */
export function surfaceBrightnessVsEye(exitPupilMm: number, eyePupilMm = EYE_PUPIL_MM): number {
  return Math.min(1, (exitPupilMm / eyePupilMm) ** 2);
}

/** Empirical visual limiting stellar magnitude: 2 + 5·log₁₀(D mm). */
export function limitingMagnitude(apertureMm: number): number {
  return 2 + 5 * Math.log10(apertureMm);
}
