/**
 * How bright the sky is, how much the air dims a target, and how steady the
 * air is. All ESTIMATED: standard simplified models, good for showing the
 * size and direction of each effect, not for photometry.
 *
 *   Light pollution: Bortle class → zenith brightness (common SQM mapping).
 *   Natural sky and moonlight: Krisciunas & Schaefer (1991), PASP 103, 1033.
 *   Twilight: piecewise fit to typical zenith brightness vs Sun depression.
 *   Extinction: Rayleigh + ozone + aerosol optical depth (k ≈ 1.086 τ).
 *   Naked-eye limit from sky brightness: the widely used SQM→NELM relation.
 */
import { cos, sin } from "./math";

/** Pristine natural sky at the zenith, V mag/arcsec². */
export const NATURAL_SKY = 21.9;
/**
 * No real night sky is darker than about 22.0 mag/arcsec² (the darkest SQM
 * readings on Earth); clamp just beyond it so extreme haze + cloud near the
 * horizon can't produce an impossible, out-of-range value.
 */
export const DARKEST_SKY = 22.3;

export const BORTLE: readonly { level: number; name: string; sqm: number }[] = [
  { level: 1, name: "Excellent dark site", sqm: 21.9 },
  { level: 2, name: "Truly dark site", sqm: 21.6 },
  { level: 3, name: "Rural sky", sqm: 21.4 },
  { level: 4, name: "Rural / suburban", sqm: 20.8 },
  { level: 5, name: "Suburban", sqm: 20.0 },
  { level: 6, name: "Bright suburban", sqm: 19.3 },
  { level: 7, name: "Suburban / urban", sqm: 18.6 },
  { level: 8, name: "City", sqm: 18.0 },
  { level: 9, name: "Inner city", sqm: 17.5 },
];

export const bortleSqm = (level: number) => BORTLE[Math.min(9, Math.max(1, Math.round(level))) - 1].sqm;
export const bortleName = (level: number) => BORTLE[Math.min(9, Math.max(1, Math.round(level))) - 1].name;

/** mag/arcsec² ↔ relative linear brightness (1 = pristine natural sky). */
export const toFlux = (mag: number) => 10 ** (-0.4 * (mag - NATURAL_SKY));
export const toMag = (flux: number) => NATURAL_SKY - 2.5 * Math.log10(Math.max(flux, 1e-9));

/** V mag/arcsec² → nanoLamberts (Krisciunas & Schaefer). */
const magToNL = (v: number) => 34.08 * Math.exp(20.7233 - 0.92104 * v);

/** K&S air mass, from zenith distance (degrees). Finite at the horizon (≈ 5). */
const ksAirmass = (zenithDeg: number) => (1 - 0.96 * sin(Math.min(90, zenithDeg)) ** 2) ** -0.5;

/**
 * Brightness of moonlight scattered into the line of sight (K&S 1991), in
 * relative flux. Zero when the Moon is down.
 */
export function moonlightFlux(o: { moonPhaseAngleDeg: number; moonAltDeg: number; separationDeg: number; targetAltDeg: number; k: number }): number {
  if (o.moonAltDeg <= 0) return 0;
  const alpha = Math.abs(o.moonPhaseAngleDeg);
  const iStar = 10 ** (-0.4 * (3.84 + 0.026 * alpha + 4e-9 * alpha ** 4));
  const rho = Math.max(o.separationDeg, 2);
  const f = 10 ** 5.36 * (1.06 + cos(rho) ** 2) + 10 ** (6.15 - rho / 40);
  const xMoon = ksAirmass(90 - o.moonAltDeg);
  const x = ksAirmass(90 - Math.max(0, o.targetAltDeg));
  const nL = f * iStar * 10 ** (-0.4 * o.k * xMoon) * (1 - 10 ** (-0.4 * o.k * x));
  return nL / magToNL(NATURAL_SKY);
}

/** Zenith brightness of twilight, mag/arcsec²; undefined once fully dark. */
export function twilightMag(sunAltDeg: number): number | undefined {
  const d = -sunAltDeg;
  if (d >= 18) return undefined;
  const pts: [number, number][] = [
    [-10, 3.5],
    [0, 4.5],
    [6, 12.5],
    [12, 17.8],
    [15, 20.3],
    [18, 23.5],
  ];
  for (let i = 1; i < pts.length; i++) {
    const [d1, m1] = pts[i];
    const [d0, m0] = pts[i - 1];
    if (d <= d1) return m0 + ((m1 - m0) * (Math.max(d, d0) - d0)) / (d1 - d0);
  }
  return undefined;
}

/** Visual extinction coefficient, mag per air mass. */
export function extinctionCoefficient(o: { aerosolOpticalDepth: number; elevationM?: number }): number {
  const rayleigh = 0.1066 * Math.exp(-(o.elevationM ?? 0) / 8000);
  const ozone = 0.016;
  return rayleigh + ozone + 1.086 * Math.max(0, o.aerosolOpticalDepth);
}

/** Aerosol optical depth (550 nm) from a haze level, when no measurement is available. */
export const HAZE: readonly { id: HazeLevel; name: string; aod: number }[] = [
  { id: "clear", name: "Very clear", aod: 0.04 },
  { id: "light", name: "Light haze", aod: 0.15 },
  { id: "hazy", name: "Hazy", aod: 0.35 },
  { id: "heavy", name: "Heavy haze / smoke", aod: 0.8 },
];
export type HazeLevel = "clear" | "light" | "hazy" | "heavy";

/** A rough haze estimate from relative humidity (humid air swells aerosols). */
export function aodFromHumidity(rh: number): number {
  return 0.06 + 0.3 * Math.max(0, (rh - 55) / 45) ** 2;
}

export interface SkyInputs {
  /** Zenith sky brightness from light pollution alone, mag/arcsec². */
  zenithSqm: number;
  sunAltDeg: number;
  moonAltDeg: number;
  moonPhaseAngleDeg: number;
  /** Angle between the target and the Moon. */
  moonSeparationDeg: number;
  /** Target altitude (apparent), degrees. */
  targetAltDeg: number;
  /** Extinction coefficient, mag per air mass. */
  k: number;
  /** Cloud cover 0…1. */
  cloud: number;
}

export interface SkyBrightness {
  /** Total at the target, mag/arcsec². */
  mag: number;
  /** Contributions as relative flux (1 = pristine sky). */
  parts: { natural: number; artificial: number; moon: number; twilight: number };
  /** What dominates. */
  dominant: "natural" | "light pollution" | "moonlight" | "twilight";
}

/** Sky brightness in the direction of the target. */
export function skyBrightness(s: SkyInputs): SkyBrightness {
  const alt = Math.max(1, s.targetAltDeg);
  const x = ksAirmass(90 - alt);
  // Natural sky brightens towards the horizon (airglow path), dimmed by extinction (K&S eq. 2).
  const natural = 10 ** (-0.4 * s.k * (x - 1)) * x;
  // Light pollution grows towards the horizon, where city domes are; clouds reflect it back down.
  const zenithArtificial = Math.max(0, toFlux(s.zenithSqm) - 1);
  const artificial = zenithArtificial * x ** 0.7 * (1 + 2.5 * s.cloud);
  const moon = moonlightFlux({ moonPhaseAngleDeg: s.moonPhaseAngleDeg, moonAltDeg: s.moonAltDeg, separationDeg: s.moonSeparationDeg, targetAltDeg: alt, k: s.k });
  const tw = twilightMag(s.sunAltDeg);
  const twilight = tw === undefined ? 0 : toFlux(tw);
  // Thick cloud hides the natural sky and moonlit sky behind it a little.
  const cloudDim = 1 - 0.5 * s.cloud;
  const parts = { natural: natural * cloudDim, artificial, moon: moon * (1 - 0.3 * s.cloud), twilight };
  const total = parts.natural + parts.artificial + parts.moon + parts.twilight;
  const ranked = (
    [
      ["natural", parts.natural],
      ["light pollution", parts.artificial],
      ["moonlight", parts.moon],
      ["twilight", parts.twilight],
    ] as const
  ).reduce((a, b) => (b[1] > a[1] ? b : a));
  return { mag: Math.min(DARKEST_SKY, toMag(total)), parts, dominant: ranked[0] };
}

/** Naked-eye limiting magnitude for a sky brightness (SQM → NELM). */
export function nakedEyeLimit(skyMag: number): number {
  return 7.93 - 5 * Math.log10(10 ** (4.316 - skyMag / 5) + 1);
}

/**
 * Rough seeing estimate, arcseconds FWHM at the zenith, from the jet-stream
 * wind (250 hPa) and the wind at the ground. ESTIMATED; real seeing needs a
 * turbulence profile.
 */
export function seeingFromWind(o: { jetMs?: number; surfaceMs?: number }): number {
  const jet = Math.max(0, (o.jetMs ?? 20) - 15) * 0.035;
  const ground = Math.max(0, (o.surfaceMs ?? 3) - 5) * 0.12;
  return Math.min(5, Math.max(0.8, 1.1 + jet + ground));
}

/** Seeing grows with the path through the air (∝ air mass^0.6). */
export const seeingAtAirmass = (zenithSeeing: number, airmass: number) => zenithSeeing * airmass ** 0.6;

/** Light let through by cloud cover 0…1 (patchy cloud averages to this). */
export const cloudTransmission = (cloud: number) => Math.max(0.03, 1 - 0.95 * Math.min(1, Math.max(0, cloud)));
