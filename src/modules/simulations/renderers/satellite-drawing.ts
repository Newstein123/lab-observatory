import type { Satellite } from "@/modules/targets/satellites";
import { drawStars, visibleStars, type StarFieldData } from "./stars";

/** Where a moon was drawn, for labelling: offsets from the planet's centre, px (west right, north up). */
export interface SatelliteMark {
  name: string;
  x: number;
  y: number;
}

/** Sunlit moons look close to the Sun's colour; the eye sees them as white points. */
const MOON_TEFF = 5500;

const ALL_SKY: StarFieldData = {
  targetId: "satellites",
  brightRadiusArcsec: Number.POSITIVE_INFINITY,
  faintRadiusArcsec: Number.POSITIVE_INFINITY,
  brightLimitMag: 99,
  faintLimitMag: 99,
  stars: [],
};

/**
 * Draw a planet's moons as points around the planet drawn at (0, 0) with
 * equatorial diameter `planetPx`. Brightness follows the same rules as
 * catalogue stars; a moon's tiny disc shows once magnification makes it
 * larger than the blur. Moons on or behind the disc are skipped.
 */
export function drawSatellites(
  ctx: CanvasRenderingContext2D,
  satellites: Satellite[],
  planetPx: number,
  o: { limitMag: number; blurPx: number; fieldRadiusPx: number; alphaScale?: number },
): SatelliteMark[] {
  const radiusPx = planetPx / 2;
  const shown = satellites.filter((s) => !s.hidden);
  // visibleStars works in arcsec with east +; pass pixels directly (1 px per "arcsec").
  const stars = shown.map((s) => ({ xi: -s.x * radiusPx, eta: s.y * radiusPx, v: s.magnitude, teff: MOON_TEFF }));
  const drawn = visibleStars(ALL_SKY, stars, {
    limitMag: o.limitMag,
    pxPerArcsec: 1,
    fieldRadiusPx: o.fieldRadiusPx,
    blurPx: o.blurPx,
    color: true,
  });
  // visibleStars drops stars outside the field or below the limit; keep names aligned.
  const marks: SatelliteMark[] = [];
  const out = drawn.map((star) => {
    const i = stars.findIndex((s) => Math.abs(-s.xi - star.x) < 1e-6 && Math.abs(-s.eta - star.y) < 1e-6);
    const sat = shown[i];
    marks.push({ name: sat.name, x: star.x, y: star.y });
    const discPx = (sat.diameter * radiusPx) / 2;
    const alphaScale = o.alphaScale ?? 1;
    return { ...star, radius: Math.max(star.radius, discPx), alpha: Math.min(1, star.alpha * alphaScale), glowAlpha: star.glowAlpha * alphaScale };
  });
  drawStars(ctx, out);
  return marks;
}
