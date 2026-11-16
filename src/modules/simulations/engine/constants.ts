import type { AssumptionId } from "./models";

/**
 * Engine version. Bump on ANY change to a formula, assumption or model, so
 * saved sessions can be reproduced against the version that produced them.
 */
export const ENGINE_VERSION = "1.2.0";

/** Arcseconds per radian (180 / π × 3600). */
export const ARCSEC_PER_RADIAN = 206_264.806;
export const ARCSEC_PER_DEGREE = 3600;
export const ARCSEC_PER_ARCMIN = 60;

/** Apparent motion of the sky at the celestial equator, arcsec per second of time. */
export const SIDEREAL_RATE_ARCSEC_PER_S = 15.041;

/** Assumed fully dark-adapted human pupil diameter. Declines with age. */
export const EYE_PUPIL_MM = 7;

/** Reference camera setup used to normalise relative exposure estimates. */
export const EXPOSURE_REFERENCE = {
  pixelSizeUm: 3.76,
  focalRatio: 5,
  exposureS: 1,
} as const;

export const ASSUMPTIONS: Record<AssumptionId, string> = {
  approximate_true_fov:
    "True field ≈ apparent field ÷ magnification. Eyepiece distortion can make the real field differ by several percent; supply a field-stop diameter for a better value.",
  eye_pupil_7mm:
    "Assumes a fully dark-adapted 7 mm eye pupil. Many adults, especially older observers, reach only 5–6 mm.",
  dawes_point_source:
    "Dawes and Rayleigh limits describe separating two equal point sources under perfect conditions. They are not a guarantee of visible planetary detail.",
  seeing_dominates_when_larger:
    "Effective resolution is taken as the larger of the optical limit and atmospheric seeing. This is a simplification; real blur combines both.",
  max_useful_magnification_rule:
    "Maximum useful magnification uses the 2× aperture-in-mm rule of thumb. Seeing usually limits magnification well before this.",
  limiting_magnitude_rule:
    "Limiting magnitude uses the empirical 2 + 5·log₁₀(D mm) rule for a dark site. Real values depend on sky brightness, experience and optics.",
  shot_noise_only:
    "Camera brightness and noise are relative estimates using photon shot noise only. Read noise, dark current, sky background, quantum efficiency and sensor response are not modelled.",
  barlow_ideal_multiplier:
    "The Barlow is treated as an ideal focal-length multiplier. Real amplification varies with the Barlow-to-focal-plane distance.",
  target_extent_fixed:
    "The target's angular size is a fixed catalogue value. Planets and the Moon change apparent size over time.",
  filter_transmission_typical:
    "Filter transmission is a typical value for this kind of filter and target, not a measured curve. Real filters and the target's spectrum vary.",
  sidereal_drift_rate:
    "An untracked mount lets the sky drift at 15.04″ per second × cos(declination). Field rotation and periodic error are not modelled.",
  declination_unknown_equator:
    "This target moves across the sky, so its declination is not fixed here; drift is computed for the celestial equator (the fastest case).",
};
