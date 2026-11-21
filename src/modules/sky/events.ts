/**
 * Rise, transit and set times, and the dark part of the night, found by
 * sampling the altitude and refining each crossing by bisection (to ~20 s).
 * CALCULATED.
 */
import { toHorizontal, type Equatorial, type Site } from "./coords";
import { sunPosition } from "./sun";

/** Standard altitudes of rise/set (geometric, refraction and semi-diameter included). */
export const HORIZON_SUN = -0.833;
export const HORIZON_MOON = -0.833; // topocentric positions: refraction 34′ + semi-diameter ~15.5′
export const HORIZON_STAR = -0.5667;
/** Astronomical darkness: Sun 18° below the horizon. */
export const DARK_SUN = -18;
/** End of civil twilight: bright planets show well from here. */
export const CIVIL_SUN = -6;

const STEP_MS = 10 * 60_000;

type AltitudeAt = (date: Date) => number;

export function altitudeFn(position: (date: Date) => Equatorial, site: Site): AltitudeAt {
  return (d) => toHorizontal(position(d), site, d).altDeg;
}

/** Times within [start, end) where altitude crosses `h0`, upwards (rise) and downwards (set). */
export function crossings(alt: AltitudeAt, h0: number, start: Date, end: Date): { rises: Date[]; sets: Date[] } {
  const rises: Date[] = [];
  const sets: Date[] = [];
  let t0 = start.getTime();
  let a0 = alt(start) - h0;
  while (t0 < end.getTime()) {
    const t1 = Math.min(t0 + STEP_MS, end.getTime());
    const a1 = alt(new Date(t1)) - h0;
    if (a0 < 0 !== a1 < 0) {
      let lo = t0;
      let hi = t1;
      let alo = a0;
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        const am = alt(new Date(mid)) - h0;
        if (am < 0 === alo < 0) {
          lo = mid;
          alo = am;
        } else hi = mid;
      }
      (a0 < 0 ? rises : sets).push(new Date(Math.round((lo + hi) / 2)));
    }
    t0 = t1;
    a0 = a1;
  }
  return { rises, sets };
}

/** The highest point in [start, end), sampled every 10 min and refined. */
export function highest(alt: AltitudeAt, start: Date, end: Date): { at: Date; altDeg: number } {
  let best = { at: start, altDeg: alt(start) };
  for (let t = start.getTime() + STEP_MS; t <= end.getTime(); t += STEP_MS) {
    const a = alt(new Date(t));
    if (a > best.altDeg) best = { at: new Date(t), altDeg: a };
  }
  // Golden-section-free refinement: a few halvings around the best sample.
  let step = STEP_MS / 2;
  let at = best.at.getTime();
  let a = best.altDeg;
  while (step > 15_000) {
    for (const t of [at - step, at + step]) {
      if (t < start.getTime() || t > end.getTime()) continue;
      const v = alt(new Date(t));
      if (v > a) {
        a = v;
        at = t;
      }
    }
    step /= 2;
  }
  return { at: new Date(at), altDeg: a };
}

/**
 * The observing night that contains (or follows) `date` at a site: from local
 * noon to the next local noon, by mean solar time at the site's longitude.
 */
export function nightWindow(date: Date, site: Site): { start: Date; end: Date } {
  const offsetMs = (site.lonDeg / 15) * 3_600_000;
  const local = date.getTime() + offsetMs;
  const dayStart = Math.floor(local / 86_400_000) * 86_400_000;
  // Before local noon, the night in progress started the previous noon.
  let noon = dayStart + 12 * 3_600_000;
  if (local < noon) noon -= 86_400_000;
  return { start: new Date(noon - offsetMs), end: new Date(noon - offsetMs + 86_400_000) };
}

export interface NightInfo {
  start: Date;
  end: Date;
  sunset?: Date;
  sunrise?: Date;
  /** Civil twilight ends / begins (Sun 6° down); the whole window in polar night. */
  civilStart?: Date;
  civilEnd?: Date;
  /** Astronomical darkness begins / ends; undefined if it never gets fully dark. */
  darkStart?: Date;
  darkEnd?: Date;
}

export function nightInfo(date: Date, site: Site): NightInfo {
  const { start, end } = nightWindow(date, site);
  const sunAlt = altitudeFn(sunPosition, site);
  const horizon = crossings(sunAlt, HORIZON_SUN, start, end);
  const dark = crossings(sunAlt, DARK_SUN, start, end);
  const civil = crossings(sunAlt, CIVIL_SUN, start, end);
  // The window starts at local noon, near the Sun's highest point: if it is
  // already below a threshold then, it stays below all night (polar night).
  const alwaysDark = sunAlt(start) < DARK_SUN;
  const alwaysCivilDark = sunAlt(start) < CIVIL_SUN;
  return {
    start,
    end,
    sunset: horizon.sets[0],
    sunrise: horizon.rises[horizon.rises.length - 1],
    civilStart: civil.sets[0] ?? (alwaysCivilDark ? start : undefined),
    civilEnd: civil.rises[civil.rises.length - 1] ?? (alwaysCivilDark ? end : undefined),
    darkStart: dark.sets[0] ?? (alwaysDark ? start : undefined),
    darkEnd: dark.rises[dark.rises.length - 1] ?? (alwaysDark ? end : undefined),
  };
}

export interface BodyEvents {
  rise?: Date;
  set?: Date;
  transit: { at: Date; altDeg: number };
  /** Always above / always below the horizon during the window. */
  circumpolar: boolean;
  neverRises: boolean;
}

export function bodyEvents(alt: AltitudeAt, h0: number, start: Date, end: Date): BodyEvents {
  const { rises, sets } = crossings(alt, h0, start, end);
  const transit = highest(alt, start, end);
  const anyCrossing = rises.length + sets.length > 0;
  return {
    rise: rises[0],
    set: sets.find((s) => !rises[0] || s > rises[0]) ?? sets[0],
    transit,
    circumpolar: !anyCrossing && transit.altDeg > h0,
    neverRises: !anyCrossing && transit.altDeg <= h0,
  };
}
