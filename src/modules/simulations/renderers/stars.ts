/**
 * Catalogue stars for the eyepiece view.
 *
 * Positions, magnitudes and colours are RETRIEVED from star catalogues
 * (Gaia DR3, Tycho-2, Hipparcos). Which stars are visible, how bright they
 * look and how much colour the eye perceives are ESTIMATED from simple
 * rules stated here. Pure functions, apart from `drawStars`, which paints
 * the result onto a canvas.
 */

export interface StarFieldData {
  targetId: string;
  /** Radius (arcsec) within which stars to `brightLimitMag` are included. */
  brightRadiusArcsec: number;
  /** Radius (arcsec) within which stars to `faintLimitMag` are included. */
  faintRadiusArcsec: number;
  brightLimitMag: number;
  faintLimitMag: number;
  /** Flat array: ξ arcsec (east +), η arcsec (north +), V × 100, Teff / 10 (0 = unknown). */
  stars: number[];
}

export interface Star {
  /** East offset, arcsec. */
  xi: number;
  /** North offset, arcsec. */
  eta: number;
  v: number;
  /** Effective temperature, K; 0 when the catalogue has no colour. */
  teff: number;
}

export function decodeStars(data: StarFieldData): Star[] {
  const out: Star[] = [];
  for (let i = 0; i + 3 < data.stars.length; i += 4) {
    out.push({ xi: data.stars[i], eta: data.stars[i + 1], v: data.stars[i + 2] / 100, teff: data.stars[i + 3] * 10 });
  }
  return out;
}

/**
 * Approximate RGB (0–255) of a blackbody at temperature T (Tanner Helland's
 * fit to Mitchell Charity's table). Adequate for star tints.
 */
export function teffToRgb(teff: number): [number, number, number] {
  const t = Math.min(40000, Math.max(1000, teff)) / 100;
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : clamp(329.698727446 * (t - 60) ** -0.1332047592);
  const g = t <= 66 ? clamp(99.4708025861 * Math.log(t) - 161.1195681661) : clamp(288.1221695283 * (t - 60) ** -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : clamp(138.5177312231 * Math.log(t - 10) - 305.0447927307);
  return [r, g, b];
}

/** Below this many magnitudes brighter than the limit, the eye starts to see colour (estimate). */
export const COLOR_ONSET_MAG = 4.5;
/** Magnitudes over which colour grows from none to its (pastel) maximum. */
export const COLOR_RAMP_MAG = 3;
/** Visual star colours are pale; full blackbody saturation overstates them. */
export const MAX_SATURATION = 0.65;

/** Perceived colour saturation 0…MAX_SATURATION for a star of magnitude v given the limit. */
export function perceivedSaturation(v: number, limitMag: number): number {
  const headroom = limitMag - v - COLOR_ONSET_MAG;
  return Math.min(1, Math.max(0, headroom / COLOR_RAMP_MAG)) * MAX_SATURATION;
}

export interface VisibleStar {
  /** Canvas offsets from the field centre, px (north up, east left). */
  x: number;
  y: number;
  /** Radius of the star's core, px. */
  radius: number;
  /** 0–1. */
  alpha: number;
  color: [number, number, number];
  /** Soft glare around bright stars (radius px, 0 = none) and its opacity. */
  glowRadius: number;
  glowAlpha: number;
}

export interface StarViewOptions {
  /** Faintest magnitude the setup shows (after any filter loss). */
  limitMag: number;
  pxPerArcsec: number;
  fieldRadiusPx: number;
  /** Gaussian sigma of the image blur (seeing, optics, focus), px. */
  blurPx: number;
  /** Show colour (false renders every star white). */
  color: boolean;
}

/**
 * Stars brighter than the limit, inside the field and inside the catalogue's
 * coverage. Near the edge of the faint coverage, faint stars fade out rather
 * than stopping at a hard circle.
 */
export function visibleStars(field: StarFieldData, stars: Star[], o: StarViewOptions): VisibleStar[] {
  const out: VisibleStar[] = [];
  const core = Math.max(0.7, o.blurPx * 1.1);
  const r2max = o.fieldRadiusPx * o.fieldRadiusPx;
  for (const s of stars) {
    if (s.v > o.limitMag) continue;
    const dist = Math.hypot(s.xi, s.eta);
    if (dist > field.brightRadiusArcsec) continue;
    let coverage = 1;
    if (s.v > field.brightLimitMag) {
      // Faint stars exist only within the faint radius; fade over the last 15 %.
      const edge = field.faintRadiusArcsec;
      if (dist > edge) continue;
      coverage = Math.min(1, (edge - dist) / (0.15 * edge));
    }
    const x = -s.xi * o.pxPerArcsec;
    const y = -s.eta * o.pxPerArcsec;
    if (x * x + y * y > r2max) continue;
    const above = o.limitMag - s.v; // magnitudes brighter than the limit
    const alpha = Math.min(1, 0.22 + 0.2 * above) * coverage;
    // Apparent size grows with brightness (the eye and optics spread bright points).
    const radius = core * (1 + 0.32 * Math.max(0, above - 2));
    // Stars far above the limit get a faint glare, as they do at the eyepiece.
    const glowRadius = above > 6 ? radius * (2.5 + 0.6 * (above - 6)) : 0;
    const glowAlpha = above > 6 ? Math.min(0.35, 0.05 * (above - 6)) : 0;
    const sat = o.color && s.teff > 0 ? perceivedSaturation(s.v, o.limitMag) : 0;
    const [r, g, b] = teffToRgb(s.teff || 6500);
    const mix = (c: number) => Math.round(255 + (c - 255) * sat);
    out.push({ x, y, radius, alpha, color: [mix(r), mix(g), mix(b)], glowRadius, glowAlpha });
  }
  return out;
}

/** Draw stars from `visibleStars` additively, with glare around bright ones. Canvas origin at the field centre. */
export function drawStars(ctx: CanvasRenderingContext2D, stars: ReturnType<typeof visibleStars>) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Faint first, so bright stars sit on top.
  for (let i = stars.length - 1; i >= 0; i--) {
    const s = stars[i];
    const [r, g, b] = s.color;
    if (s.glowRadius > 0) {
      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.glowRadius);
      glow.addColorStop(0, `rgba(${r},${g},${b},${s.glowAlpha})`);
      glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    const halo = s.radius * 2.4;
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, halo);
    grad.addColorStop(0, `rgba(${r},${g},${b},${s.alpha})`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},${s.alpha * 0.55})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, halo, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
