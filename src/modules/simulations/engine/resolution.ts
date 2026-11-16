/** Dawes limit θ ≈ 116 / D (arcseconds, D in mm). */
export function dawesLimit(apertureMm: number): number {
  return 116 / apertureMm;
}

/** Rayleigh criterion θ ≈ 138 / D (arcseconds, D in mm, λ ≈ 550 nm). */
export function rayleighLimit(apertureMm: number): number {
  return 138 / apertureMm;
}

/**
 * Simplified effective resolution: the larger of the optical limit and seeing.
 * Returns the optical limit unchanged when seeing is unknown.
 */
export function effectiveResolution(opticalLimitArcsec: number, seeingArcsec?: number): number {
  if (seeingArcsec === undefined) return opticalLimitArcsec;
  return Math.max(opticalLimitArcsec, seeingArcsec);
}
