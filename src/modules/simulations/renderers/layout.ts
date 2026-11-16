import type { SimulationResult } from "@/modules/simulations/engine";
import type { TargetCategory } from "@/modules/targets/catalogue";

/**
 * Pure viewport geometry and appearance parameters.
 *
 * Everything in this file is ILLUSTRATIVE (spec §7): it maps engine outputs
 * to pixels and visual effects. Scale and framing follow the calculated
 * field of view exactly; brightness, blur and noise are simplified models.
 */

export type EyepieceResult = Extract<SimulationResult, { mode: "eyepiece" }>;
export type CameraResult = Extract<SimulationResult, { mode: "camera" }>;

/** Gaussian sigma = FWHM / (2·√(2·ln 2)). */
export const FWHM_TO_SIGMA = 1 / 2.3548;
/** Canvas blur beyond this is visually equivalent and expensive. */
export const MAX_BLUR_PX = 40;

/**
 * Relative visual prominence of each target class through an eyepiece.
 * Solar-system bodies are bright; diffuse deep-sky objects much less so.
 */
const VISUAL_VISIBILITY: Record<TargetCategory, number> = {
  moon: 1,
  planet: 1,
  nebula: 0.6,
  galaxy: 0.4,
  cluster: 0.9,
};

/**
 * Mean surface brightness (mag/arcsec²) of the target each class's constants
 * were tuned on (Jupiter/Saturn, M42, M31, M13). Other targets are scaled
 * relative to it, so a faint galaxy renders dimmer than a bright one.
 */
const REFERENCE_SURFACE_BRIGHTNESS: Record<TargetCategory, number> = {
  moon: 3.4,
  planet: 6.4,
  nebula: 21.9,
  galaxy: 22.2,
  cluster: 20.9,
};

/** Brightness factor relative to the class reference (1 when unknown). */
export function relativeSurfaceFactor(category: TargetCategory, surfaceBrightness?: number): number {
  if (surfaceBrightness === undefined) return 1;
  return 10 ** (-0.4 * (surfaceBrightness - REFERENCE_SURFACE_BRIGHTNESS[category]));
}

/**
 * Relative camera sensitivity per class, chosen so each target's suggested
 * exposure lands at a mid-to-high display level at the reference setup.
 */
export const CAMERA_SENSITIVITY: Record<TargetCategory, number> = {
  moon: 240,
  planet: 120,
  nebula: 0.04,
  galaxy: 0.01,
  cluster: 0.04,
};

/** Photon count at unit (sensitivity × relative signal); sets the shot-noise floor. */
const PHOTONS_PER_UNIT = 400;
const MIN_NOISE_LEVEL = 0.05;
const MAX_NOISE_SIGMA = 0.35;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface EyepieceLayout {
  sizePx: number;
  fieldRadiusPx: number;
  pxPerArcsec: number;
  targetMajorPx: number;
  targetMinorPx: number;
  blurPx: number;
  /** 0–1 overall brightness multiplier. */
  brightness: number;
}

export interface EyepieceViewOptions {
  category: TargetCategory;
  /** 0 = in focus, 1 = badly defocused. */
  focusOffset: number;
  /** Target's mean surface brightness, mag/arcsec² (optional refinement). */
  surfaceBrightness?: number;
}

export function computeEyepieceLayout(
  result: EyepieceResult,
  sizePx: number,
  { category, focusOffset, surfaceBrightness }: EyepieceViewOptions,
): EyepieceLayout {
  const { framing, metrics } = result;
  if (framing.shape !== "circle") throw new Error("Eyepiece result must have circular framing");

  const fieldRadiusPx = (sizePx / 2) * 0.94;
  const pxPerArcsec = (2 * fieldRadiusPx) / framing.fieldDiameterArcsec;
  const resolutionArcsec = (metrics.effectiveResolution ?? metrics.dawesLimit).value;
  const opticalBlurPx = resolutionArcsec * pxPerArcsec * FWHM_TO_SIGMA;
  const focusBlurPx = clamp(focusOffset, 0, 1) * fieldRadiusPx * 0.05;

  // Perceived brightness falls roughly logarithmically with surface brightness.
  const sb = metrics.surfaceBrightnessVsEye.value;
  // Fainter targets of the same class look dimmer, compressed as the eye perceives it.
  const targetFactor = clamp(1 + Math.log10(relativeSurfaceFactor(category, surfaceBrightness)) / 4, 0.35, 1.3);
  const brightness = clamp(VISUAL_VISIBILITY[category] * targetFactor * (1 + Math.log10(sb) / 3), 0.08, 1);

  return {
    sizePx,
    fieldRadiusPx,
    pxPerArcsec,
    targetMajorPx: framing.targetMajorArcsec * pxPerArcsec,
    targetMinorPx: framing.targetMinorArcsec * pxPerArcsec,
    blurPx: Math.min(MAX_BLUR_PX, opticalBlurPx + focusBlurPx),
    brightness,
  };
}

export interface CameraLayout {
  displayWidthPx: number;
  displayHeightPx: number;
  /** Offscreen render size: one render pixel ≥ one sensor pixel. */
  renderWidthPx: number;
  renderHeightPx: number;
  /** Screen pixels covered by one sensor pixel at this zoom. */
  sensorPixelScreenPx: number;
  /** Visible field after zoom, arcseconds. */
  visibleWidthArcsec: number;
  visibleHeightArcsec: number;
  targetMajorPx: number;
  targetMinorPx: number;
  blurPx: number;
  /** 0–1 display level of the target's peak. */
  level: number;
  /** Std-dev of per-pixel display noise, 0–1 units. */
  noiseSigma: number;
}

export interface CameraViewOptions {
  category: TargetCategory;
  /** Crop factor ≥ 1 around the field centre. */
  zoom: number;
  gain: number;
  /** Set when exposure is simulated; otherwise a neutral preview is drawn. */
  exposureS?: number;
  surfaceBrightness?: number;
}

export function computeCameraLayout(
  result: CameraResult,
  displayWidthPx: number,
  { category, zoom, gain, exposureS, surfaceBrightness }: CameraViewOptions,
): CameraLayout {
  const { framing, metrics } = result;
  if (framing.shape !== "rectangle") throw new Error("Camera result must have rectangular framing");

  const z = Math.max(1, zoom);
  const visibleWidthArcsec = framing.fieldWidthArcsec / z;
  const visibleHeightArcsec = framing.fieldHeightArcsec / z;
  const displayHeightPx = Math.round(displayWidthPx * (visibleHeightArcsec / visibleWidthArcsec));

  const sensorPxAcross = visibleWidthArcsec / metrics.imageScale.value;
  const renderWidthPx = Math.max(8, Math.round(Math.min(sensorPxAcross, displayWidthPx)));
  const renderHeightPx = Math.max(8, Math.round(renderWidthPx * (visibleHeightArcsec / visibleWidthArcsec)));
  const renderPxPerArcsec = renderWidthPx / visibleWidthArcsec;

  const resolutionArcsec = (metrics.effectiveResolution ?? metrics.dawesLimit).value;

  let level = 0.85;
  let noiseSigma = 0;
  if (exposureS !== undefined && metrics.relativeExposureIndex) {
    const signal = metrics.relativeExposureIndex.value / gain;
    const k = CAMERA_SENSITIVITY[category] * relativeSurfaceFactor(category, surfaceBrightness);
    level = 1 - Math.exp(-k * signal * gain);
    const photons = Math.max(1, PHOTONS_PER_UNIT * k * signal);
    noiseSigma = Math.min(MAX_NOISE_SIGMA, Math.max(level, MIN_NOISE_LEVEL) / Math.sqrt(photons));
  }

  return {
    displayWidthPx,
    displayHeightPx,
    renderWidthPx,
    renderHeightPx,
    sensorPixelScreenPx: displayWidthPx / sensorPxAcross,
    visibleWidthArcsec,
    visibleHeightArcsec,
    targetMajorPx: framing.targetMajorArcsec * renderPxPerArcsec,
    targetMinorPx: framing.targetMinorArcsec * renderPxPerArcsec,
    blurPx: Math.min(MAX_BLUR_PX, resolutionArcsec * renderPxPerArcsec * FWHM_TO_SIGMA),
    level,
    noiseSigma,
  };
}

/** Choose a "nice" scale-bar length (arcsec) of at most maxArcsec. */
export function niceScaleBarArcsec(maxArcsec: number): number {
  const steps = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 18000, 36000];
  let best = steps[0];
  for (const s of steps) if (s <= maxArcsec) best = s;
  return best;
}
