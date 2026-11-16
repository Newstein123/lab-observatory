import { ARCSEC_PER_RADIAN, EXPOSURE_REFERENCE } from "./constants";

/** Image scale = 206.265 × pixel size (µm) / focal length (mm), arcsec per pixel. */
export function imageScale(pixelSizeUm: number, focalLengthMm: number): number {
  return (ARCSEC_PER_RADIAN / 1000) * (pixelSizeUm / focalLengthMm);
}

/**
 * Angular field across one sensor dimension, using exact geometry:
 * 2·atan(d / 2F). Returned in arcseconds.
 */
export function sensorFovArcsec(sensorDimensionMm: number, focalLengthMm: number): number {
  return 2 * Math.atan(sensorDimensionMm / (2 * focalLengthMm)) * ARCSEC_PER_RADIAN;
}

/**
 * Sampling ratio = seeing FWHM / image scale (pixels across the seeing disc).
 * Roughly 2–3.5 is commonly considered well sampled for deep-sky imaging.
 */
export function samplingRatio(seeingArcsec: number, imageScaleArcsecPerPx: number): number {
  return seeingArcsec / imageScaleArcsecPerPx;
}

export type SamplingClass = "undersampled" | "well_sampled" | "oversampled";

export function classifySampling(ratio: number): SamplingClass {
  if (ratio < 2) return "undersampled";
  if (ratio > 3.5) return "oversampled";
  return "well_sampled";
}

/**
 * Relative per-pixel signal for an extended source, normalised to the
 * reference setup (1 s, f/5, 3.76 µm pixel). Signal per pixel scales with
 * exposure × (pixel size / focal ratio)². Gain is excluded: it amplifies
 * signal and noise together.
 */
export function relativeSignal(exposureS: number, pixelSizeUm: number, fRatio: number): number {
  const ref = EXPOSURE_REFERENCE;
  return (
    (exposureS / ref.exposureS) *
    (pixelSizeUm / ref.pixelSizeUm) ** 2 *
    (ref.focalRatio / fRatio) ** 2
  );
}

/** Displayed brightness index: relative signal × gain. */
export function relativeExposureIndex(signal: number, gain: number): number {
  return signal * gain;
}

/** Relative shot noise (N / S = 1 / √S), normalised to the reference setup. */
export function relativeNoise(signal: number): number {
  return 1 / Math.sqrt(signal);
}
