/**
 * Coordinate conversions: equatorial ↔ horizontal, precession, refraction,
 * airmass and angular separations. Formulas from J. Meeus, "Astronomical
 * Algorithms" (2nd ed.) unless noted. CALCULATED.
 */
import { asin, atan2, cos, norm360, sin, tan } from "./math";
import { lst } from "./time";

export interface Equatorial {
  /** Right ascension, degrees. */
  raDeg: number;
  decDeg: number;
}

export interface Horizontal {
  /** Geometric altitude, degrees (no refraction). */
  altDeg: number;
  /** Azimuth from north through east, degrees. */
  azDeg: number;
}

export interface Site {
  latDeg: number;
  /** East-positive. */
  lonDeg: number;
  elevationM?: number;
}

/** Altitude and azimuth of a body at a site and time (Meeus 13.5–13.6, azimuth from north). */
export function toHorizontal(eq: Equatorial, site: Site, date: Date): Horizontal {
  const h = lst(date, site.lonDeg) - eq.raDeg;
  const phi = site.latDeg;
  const alt = asin(sin(phi) * sin(eq.decDeg) + cos(phi) * cos(eq.decDeg) * cos(h));
  const az = atan2(-cos(eq.decDeg) * sin(h), sin(eq.decDeg) * cos(phi) - cos(eq.decDeg) * sin(phi) * cos(h));
  return { altDeg: alt, azDeg: norm360(az) };
}

/** Hour angle, degrees (−180…180, west positive). */
export function hourAngle(eq: Equatorial, site: Site, date: Date): number {
  return ((lst(date, site.lonDeg) - eq.raDeg + 540) % 360) - 180;
}

/**
 * Parallactic angle, degrees (Meeus 14.1): the angle between the direction to
 * the celestial pole and the zenith at the body. Rotates a sky position angle
 * into how the object looks to an observer standing upright.
 */
export function parallacticAngle(eq: Equatorial, site: Site, date: Date): number {
  const h = hourAngle(eq, site, date);
  return atan2(sin(h), tan(site.latDeg) * cos(eq.decDeg) - sin(eq.decDeg) * cos(h));
}

/** Atmospheric refraction for a geometric altitude, degrees (Sæmundsson, 10 °C, 1010 hPa). */
export function refraction(altDeg: number): number {
  if (altDeg < -1.9) return 0;
  return 1.02 / tan(altDeg + 10.3 / (altDeg + 5.11)) / 60;
}

/** Altitude as seen, refraction included. */
export function apparentAltitude(altDeg: number): number {
  return altDeg + refraction(altDeg);
}

/**
 * Relative air mass at an apparent altitude (Kasten & Young 1989). 1 at the
 * zenith, about 38 at the horizon; undefined below it.
 */
export function airmass(apparentAltDeg: number): number | undefined {
  if (apparentAltDeg < 0) return undefined;
  return 1 / (sin(apparentAltDeg) + 0.50572 * (apparentAltDeg + 6.07995) ** -1.6364);
}

/** Angle between two sky positions, degrees. */
export function separation(a: Equatorial, b: Equatorial): number {
  const c = sin(a.decDeg) * sin(b.decDeg) + cos(a.decDeg) * cos(b.decDeg) * cos(a.raDeg - b.raDeg);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Position angle of b as seen from a, from north through east, degrees. */
export function positionAngle(from: Equatorial, to: Equatorial): number {
  const dRa = to.raDeg - from.raDeg;
  return norm360(atan2(cos(to.decDeg) * sin(dRa), sin(to.decDeg) * cos(from.decDeg) - cos(to.decDeg) * sin(from.decDeg) * cos(dRa)));
}

/** Precess J2000 coordinates to the equinox of date (Meeus 21.2–21.4). */
export function precessFromJ2000(eq: Equatorial, t: number): Equatorial {
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3) / 3600;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3) / 3600;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3) / 3600;
  const a = cos(eq.decDeg) * sin(eq.raDeg + zeta);
  const b = cos(theta) * cos(eq.decDeg) * cos(eq.raDeg + zeta) - sin(theta) * sin(eq.decDeg);
  const c = sin(theta) * cos(eq.decDeg) * cos(eq.raDeg + zeta) + cos(theta) * sin(eq.decDeg);
  return { raDeg: norm360(atan2(a, b) + z), decDeg: asin(c) };
}

/** Ecliptic (longitude, latitude) to equatorial, for an obliquity ε. */
export function eclipticToEquatorial(lonDeg: number, latDeg: number, epsDeg: number): Equatorial {
  const ra = atan2(sin(lonDeg) * cos(epsDeg) - tan(latDeg) * sin(epsDeg), cos(lonDeg));
  const dec = asin(sin(latDeg) * cos(epsDeg) + cos(latDeg) * sin(epsDeg) * sin(lonDeg));
  return { raDeg: norm360(ra), decDeg: dec };
}

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"] as const;

/** Sixteen-point compass direction of an azimuth. */
export function compass(azDeg: number): (typeof COMPASS)[number] {
  return COMPASS[Math.round(norm360(azDeg) / 22.5) % 16];
}
