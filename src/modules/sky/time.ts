/**
 * Time scales for the sky calculations.
 *
 * ΔT (TT − UT, about 69 s in the 2020s) is ignored: the Moon moves about 35″
 * in that time, far below the ~0.2° accuracy these low-precision theories aim
 * for. CALCULATED.
 */
import { norm360 } from "./math";

/** Julian Day (UT) of a JavaScript date. */
export function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

/** Julian centuries since J2000.0. */
export function julianCenturies(date: Date): number {
  return (julianDay(date) - 2_451_545.0) / 36_525;
}

/** Greenwich mean sidereal time, degrees (Meeus 12.4). */
export function gmst(date: Date): number {
  const jd = julianDay(date);
  const t = (jd - 2_451_545.0) / 36_525;
  return norm360(280.46061837 + 360.98564736629 * (jd - 2_451_545.0) + 0.000387933 * t * t - (t * t * t) / 38_710_000);
}

/** Local sidereal time, degrees; longitude east-positive. */
export function lst(date: Date, lonDeg: number): number {
  return norm360(gmst(date) + lonDeg);
}

/** Mean obliquity of the ecliptic, degrees. */
export function obliquity(t: number): number {
  return 23.439291 - 0.0130042 * t;
}
