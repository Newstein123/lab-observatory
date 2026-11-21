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

/** Naked-eye limiting magnitude for a sky brightness in V mag/arcsec² (the common SQM→NELM relation). */
export function nakedEyeLimit(skyMagArcsec2: number): number {
  return 7.93 - 5 * Math.log10(10 ** (4.316 - skyMagArcsec2 / 5) + 1);
}

/** Pristine natural sky, V mag/arcsec². */
export const PRISTINE_SKY = 21.9;

/**
 * Sky background as seen through the eyepiece: the telescope can't brighten
 * the sky per unit area, and an exit pupil smaller than the eye's darkens it.
 */
export function skyBackgroundAtEye(skyMagArcsec2: number, exitPupilMm: number, eyePupilMm = EYE_PUPIL_MM): number {
  return skyMagArcsec2 - 2.5 * Math.log10(surfaceBrightnessVsEye(exitPupilMm, eyePupilMm));
}

/**
 * Limiting magnitude under a given sky: the dark-site rule, lowered by how
 * much this sky (as seen at the eyepiece) cuts the eye's reach compared with
 * a pristine sky at the same exit pupil.
 */
export function skyLimitedMagnitude(apertureMm: number, skyMagArcsec2: number, exitPupilMm = EYE_PUPIL_MM): number {
  const here = nakedEyeLimit(skyBackgroundAtEye(skyMagArcsec2, exitPupilMm));
  const pristine = nakedEyeLimit(skyBackgroundAtEye(PRISTINE_SKY, exitPupilMm));
  return limitingMagnitude(apertureMm) + Math.min(0, here - pristine);
}

/** Empirical visual limiting stellar magnitude: 2 + 5·log₁₀(D mm). */
export function limitingMagnitude(apertureMm: number): number {
  return 2 + 5 * Math.log10(apertureMm);
}
