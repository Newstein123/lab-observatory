/**
 * The Sun's apparent position (Meeus ch. 25, low accuracy: about 0.01°) and
 * the twilight state at a site. CALCULATED.
 */
import { eclipticToEquatorial, toHorizontal, type Equatorial, type Site } from "./coords";
import { cos, norm360, sin } from "./math";
import { julianCenturies, obliquity } from "./time";

export interface SunPosition extends Equatorial {
  /** Apparent ecliptic longitude, degrees. */
  lonDeg: number;
  distanceAu: number;
}

export function sunPosition(date: Date): SunPosition {
  const t = julianCenturies(date);
  const l0 = norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const m = norm360(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
  const e = 0.016708634 - 0.000042037 * t;
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(m) + (0.019993 - 0.000101 * t) * sin(2 * m) + 0.000289 * sin(3 * m);
  const trueLon = l0 + c;
  const nu = m + c;
  const r = (1.000001018 * (1 - e * e)) / (1 + e * cos(nu));
  const omega = 125.04 - 1934.136 * t;
  const lon = norm360(trueLon - 0.00569 - 0.00478 * sin(omega));
  const eps = obliquity(t) + 0.00256 * cos(omega);
  return { ...eclipticToEquatorial(lon, 0, eps), lonDeg: lon, distanceAu: r };
}

export type Twilight = "day" | "civil" | "nautical" | "astronomical" | "night";

/** Twilight state from the Sun's geometric altitude. */
export function twilightOf(sunAltDeg: number): Twilight {
  if (sunAltDeg > -0.833) return "day";
  if (sunAltDeg > -6) return "civil";
  if (sunAltDeg > -12) return "nautical";
  if (sunAltDeg > -18) return "astronomical";
  return "night";
}

export const TWILIGHT_LABEL: Record<Twilight, string> = {
  day: "Daytime",
  civil: "Civil twilight",
  nautical: "Nautical twilight",
  astronomical: "Astronomical twilight",
  night: "Fully dark",
};

export function sunAltitude(site: Site, date: Date): number {
  return toHorizontal(sunPosition(date), site, date).altDeg;
}
