/**
 * Saturn's eight major moons, from mean-orbit models fitted to JPL Horizons
 * (sat441) over 2022–2032 (scripts/fetch-planet-data.mjs). Fit residuals:
 * under ~500 km for all but Hyperion (whose chaotic, resonant orbit leaves
 * errors of a few thousand km). CALCULATED; valid inside the fitted span.
 *
 * The model data (~270 kB) is loaded on demand.
 */
import { planetPosition, SATURN_RADIUS_KM, SATURN_RING_RATIO } from "@/modules/sky/planets";
import { julianDay } from "@/modules/sky/time";
import type { Satellite } from "./satellites";

export interface MoonSegment {
  startJd: number;
  endJd: number;
  epochJd: number;
  tScale: number;
  h: number[];
  e1: number[];
  e2: number[];
  l0: number;
  n: number;
  thetaTerms: number[];
  rTerms: number[];
  zTerms: number[];
}

export interface SaturnMoonModel {
  id: string;
  name: string;
  magnitude: number;
  physical: { meanRadiusKm?: number; semiMajorAxisKm?: number; orbitalPeriodDays?: number; eccentricity?: number; geometricAlbedo?: number };
  residualKm: { max: number; rms: number };
  segments: MoonSegment[];
}

export interface SaturnMoonData {
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  fitSpan: [string, string];
  method: string;
  moons: SaturnMoonModel[];
}

let dataPromise: Promise<SaturnMoonData> | undefined;
export function loadSaturnMoonData(): Promise<SaturnMoonData> {
  dataPromise ??= import("@/modules/explorer/saturn/moons.json").then((m) => m.default as unknown as SaturnMoonData);
  return dataPromise;
}

const D2R = Math.PI / 180;
const LIGHT_DAYS_PER_AU = 499.004784 / 86_400;
/** TT − UT (s), close enough for these moons' motion over a minute. */
const DELTA_T_S = 69;

function basis(lambdaDeg: number, tDays: number, tScale: number): number[] {
  const l = lambdaDeg * D2R;
  const t = tDays / tScale;
  const s1 = Math.sin(l);
  const c1 = Math.cos(l);
  const s2 = Math.sin(2 * l);
  const c2 = Math.cos(2 * l);
  return [s1, c1, t * s1, t * c1, t * t * s1, t * t * c1, s2, c2, t * s2, t * c2];
}

/** Saturn-centred position, km, ICRF, at a TDB Julian day. */
export function moonVector(m: SaturnMoonModel, jd: number): [number, number, number] {
  const seg = m.segments.find((s) => jd >= s.startJd && jd <= s.endJd) ?? (jd < m.segments[0].startJd ? m.segments[0] : m.segments[m.segments.length - 1]);
  const t = jd - seg.epochJd;
  const lam = seg.l0 + seg.n * t;
  const b = basis(lam, t, seg.tScale);
  let th = lam;
  for (let i = 0; i < seg.thetaTerms.length; i++) th += seg.thetaTerms[i] * b[i];
  let r = seg.rTerms[0];
  for (let i = 1; i < seg.rTerms.length; i++) r += seg.rTerms[i] * b[i - 1];
  let z = 0;
  for (let i = 0; i < seg.zTerms.length; i++) z += seg.zTerms[i] * b[i];
  const a = th * D2R;
  const ip = Math.sqrt(Math.max(0, r * r - z * z));
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [0, 1, 2].map((i) => ip * (c * seg.e1[i] + s * seg.e2[i]) + z * seg.h[i]) as [number, number, number];
}

export interface SkyOffset {
  /** km towards celestial west, north and towards the observer. */
  westKm: number;
  northKm: number;
  towardsKm: number;
}

/** A Saturn-centred ICRF vector as seen from Earth: offsets on the sky (J2000 frame). */
export function toSky(v: [number, number, number], raDeg: number, decDeg: number): SkyOffset {
  const a = raDeg * D2R;
  const d = decDeg * D2R;
  const east = [-Math.sin(a), Math.cos(a), 0];
  const north = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  const away = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const dot = (u: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return { westKm: -dot(east), northKm: dot(north), towardsKm: -dot(away) };
}

/** Polar/equatorial radius of Saturn's globe. */
const FLATTENING = 0.902;
const RING_KM = SATURN_RADIUS_KM * SATURN_RING_RATIO;

/**
 * Moons placed on the sky for a date: offsets west/north in units of the
 * ring system's outer radius (Saturn's catalogued major semi-axis, so they
 * scale with the drawn target), light time included.
 */
export function saturnMoons(data: SaturnMoonData, date: Date, poleAngleDeg = 0): Satellite[] {
  const saturn = planetPosition("saturn", date);
  const jd = julianDay(date) + DELTA_T_S / 86_400 - saturn.distanceAu * LIGHT_DAYS_PER_AU;
  const p = poleAngleDeg * D2R;
  return data.moons.map((m) => {
    const o = toSky(moonVector(m, jd), saturn.j2000.raDeg, saturn.j2000.decDeg);
    // In the planet's frame (x along the equator, y towards the pole) to test against the globe.
    const east = -o.westKm;
    const xe = east * Math.cos(p) - o.northKm * Math.sin(p);
    const yn = east * Math.sin(p) + o.northKm * Math.cos(p);
    const onDisc = (xe / SATURN_RADIUS_KM) ** 2 + (yn / (SATURN_RADIUS_KM * FLATTENING)) ** 2 < 1;
    return {
      name: m.name,
      x: o.westKm / RING_KM,
      y: o.northKm / RING_KM,
      z: o.towardsKm / RING_KM,
      inFront: o.towardsKm > 0,
      hidden: onDisc,
      magnitude: m.magnitude,
      diameter: (2 * (m.physical.meanRadiusKm ?? 0)) / RING_KM,
    };
  });
}

export const SATURN_MOON_METHOD =
  "Positions from orbit models fitted to JPL Horizons (sat441), light time included; Hyperion is approximate. Brightness is a typical value (Iapetus is much brighter on one side of its orbit).";
