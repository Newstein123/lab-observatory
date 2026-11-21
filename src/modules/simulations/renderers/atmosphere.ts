/**
 * How the sky and air change the picture (ILLUSTRATIVE): the sky background's
 * level and colour, how much a target fades into it, and its dimming by
 * extinction and cloud. The numbers come from the engine conditions; the
 * mapping to pixels is a visual approximation.
 */
import type { CuratedTarget } from "@/modules/targets/catalogue";
import { coreSurfaceBrightness } from "@/modules/targets/reach";

export type SkyGlowSource = "natural" | "light pollution" | "moonlight" | "twilight";

/** The atmosphere as the renderers need it. */
export interface ViewAtmosphere {
  /** Sky brightness towards the target, mag/arcsec². */
  skyMag: number;
  /** What makes the sky bright (sets its colour). */
  source: SkyGlowSource;
  extinctionMag: number;
  /** Cloud cover 0…1. */
  cloud: number;
  /** Apparent altitude, degrees. */
  altitudeDeg: number;
}

/** Phase of the Moon or a planet, as drawn. */
export interface ViewPhase {
  /** Fraction lit, 0…1. */
  illuminated: number;
  /** Direction of the lit side, degrees counter-clockwise from screen-up. */
  brightLimbDeg: number;
  /** Faint light on the dark side (the Moon only). */
  earthshine?: boolean;
}

export const PRISTINE_SKY = 21.9;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Display level (0…1) of a sky background of a given brightness: a pristine
 * sky is almost black, a city sky a murky grey, twilight bright, day white.
 */
export function skyLevel(skyMagAtEye: number): number {
  return clamp(0.02 + (PRISTINE_SKY - skyMagAtEye) / 18, 0.02, 0.97);
}

const SKY_COLOUR: Record<SkyGlowSource, [number, number, number]> = {
  natural: [70, 90, 130],
  // Sodium and LED street lighting: a warm, brownish glow.
  "light pollution": [190, 150, 115],
  moonlight: [130, 150, 190],
  twilight: [80, 125, 205],
};

/** CSS colour of the sky background. */
export function skyColour(skyMagAtEye: number, source: SkyGlowSource): string {
  const level = skyLevel(skyMagAtEye);
  const [r, g, b] = SKY_COLOUR[source];
  // At night the field is near-black whatever the source; brighter skies take on the colour.
  const mix = (c: number, base: number) => Math.round(base + (c * Math.min(1, level * 1.25) - base) * Math.min(1, level * 4));
  return `rgb(${mix(r, 5)}, ${mix(g, 7)}, ${mix(b, 12)})`;
}

/**
 * How visible a galaxy's or nebula's brightest part is against the sky,
 * 0 (lost) … 1 (unaffected). Moon, planets and clusters stay 1.
 */
export function deepSkyVisibility(target: CuratedTarget, skyMagAtEye: number, extinctionMag: number): number {
  const core = coreSurfaceBrightness(target);
  if (core === undefined) return 1;
  return clamp((skyMagAtEye - (core + extinctionMag) + 3.5) / 5, 0, 1);
}

/** Overall dimming of the target by the air and cloud (0…1). Bright bodies dim less to the adapted eye. */
export function atmosphericDimming(target: CuratedTarget, a: ViewAtmosphere): number {
  const bright = target.category === "moon" || target.category === "planet";
  const ext = 10 ** (-0.4 * a.extinctionMag * (bright ? 0.5 : 1));
  const cloud = Math.max(0.03, 1 - 0.95 * a.cloud);
  return clamp(ext * cloud, 0, 1);
}

/** Warm cast near the horizon, where blue light is scattered away (multiply tint), if noticeable. */
export function horizonTint(a: ViewAtmosphere): string | undefined {
  if (a.altitudeDeg >= 25 || a.altitudeDeg < 0) return undefined;
  const t = clamp((25 - a.altitudeDeg) / 25, 0, 1);
  return `rgb(255, ${Math.round(255 - 45 * t)}, ${Math.round(255 - 95 * t)})`;
}
