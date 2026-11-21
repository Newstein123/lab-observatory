/**
 * Jupiter's rotation as seen from Earth: central meridian longitudes in
 * Systems I and II, the planetocentric latitude of the Earth (Meeus ch. 43,
 * low accuracy: about 0.1°), and the axis position angle. CALCULATED.
 */
import { asin, cos, norm360, sin } from "./math";
import { poleAngleDeg } from "./planets";
import { julianDay } from "./time";

export interface JupiterOrientation {
  /** Central meridian, System I (equatorial clouds), degrees. */
  cm1Deg: number;
  /** Central meridian, System II (temperate latitudes; the Great Red Spot), degrees. */
  cm2Deg: number;
  /** Planetocentric latitude of the Earth (sub-observer point), degrees. */
  subLatDeg: number;
  /** Position angle of the north pole, degrees. */
  axisPaDeg: number;
}

export const JUPITER_FLATTENING = 0.06487;

/** TT − UT, seconds: Jupiter turns 0.7° in this time, so it is not ignored here. */
const DELTA_T_S = 69;

export function jupiterOrientation(date: Date): JupiterOrientation {
  const d = julianDay(date) + DELTA_T_S / 86_400 - 2_451_545.0;
  const V = 172.74 + 0.00111588 * d;
  const M = 357.529 + 0.9856003 * d;
  const N = 20.02 + 0.0830853 * d + 0.329 * sin(V);
  const J = 66.115 + 0.9025179 * d - 0.329 * sin(V);
  const A = 1.915 * sin(M) + 0.02 * sin(2 * M);
  const B = 5.555 * sin(N) + 0.168 * sin(2 * N);
  const K = J + A - B;
  const R = 1.00014 - 0.01671 * cos(M) - 0.00014 * cos(2 * M);
  const r = 5.20872 - 0.25208 * cos(N) - 0.00611 * cos(2 * N);
  const delta = Math.sqrt(r * r + R * R - 2 * r * R * cos(K));
  const psi = asin((R / delta) * sin(K));
  const t = d - delta / 173; // light time
  // Geometric disc centre. (Meeus' optional phase correction gives the centre of the
  // illuminated disc instead; labels are placed on the geometric disc.)
  const cm1 = norm360(210.98 + 877.8169088 * t + psi - B);
  const cm2 = norm360(187.23 + 870.1869088 * t + psi - B);
  const lambda = 34.35 + 0.083091 * d + 0.329 * sin(V) + B;
  const Ds = 3.12 * sin(lambda + 42.8);
  const De = Ds - 2.22 * sin(psi) * cos(lambda + 22) - 1.3 * ((r - delta) / delta) * sin(lambda - 100.5);
  return { cm1Deg: cm1, cm2Deg: cm2, subLatDeg: De, axisPaDeg: poleAngleDeg("jupiter", date) ?? 0 };
}

/**
 * Where a point on Jupiter (planetographic latitude, System II west
 * longitude) appears on the disc: x west and y down (canvas), in equatorial
 * radii, north turned by the axis angle; z > 0 on the visible hemisphere.
 */
export function projectJovian(latDeg: number, lonWestDeg: number, o: Pick<JupiterOrientation, "cm2Deg" | "subLatDeg" | "axisPaDeg">) {
  const f = JUPITER_FLATTENING;
  // Reduced latitude puts the point on the oblate surface.
  const beta = Math.atan((1 - f) * Math.tan((latDeg * Math.PI) / 180));
  const dl = ((o.cm2Deg - lonWestDeg) * Math.PI) / 180; // west of the central meridian → sky west
  const X = Math.cos(beta) * Math.sin(dl);
  const Y = (1 - f) * Math.sin(beta);
  const Z = Math.cos(beta) * Math.cos(dl);
  const de = (o.subLatDeg * Math.PI) / 180;
  const y = Y * Math.cos(de) - Z * Math.sin(de);
  const z = Y * Math.sin(de) + Z * Math.cos(de);
  // Same turn as drawTarget's rotationDeg and the Moon's projection.
  const t = (-o.axisPaDeg * Math.PI) / 180;
  const cx = X;
  const cy = -y;
  return { x: cx * Math.cos(t) - cy * Math.sin(t), y: cx * Math.sin(t) + cy * Math.cos(t), z, sunDot: 1 };
}

/**
 * The Great Red Spot's System II longitude: ESTIMATED. It drifts (about
 * 1.75°/month recently, with a ~90-day ±0.6° oscillation), so this follows
 * Sky & Telescope's published linear model unless the user supplies a
 * measured value (e.g. from JUPOS) with its date.
 */
export const GRS_MODEL = { lonDeg: 91, atIso: "2026-06-01T00:00:00Z", driftDegPerMonth: 1.75 };

export function grsLongitude(date: Date, measured?: { lonDeg: number; atIso: string }): number {
  const ref = measured ?? GRS_MODEL;
  const months = (date.getTime() - Date.parse(ref.atIso)) / (30.4375 * 86_400_000);
  return norm360(ref.lonDeg + GRS_MODEL.driftDegPerMonth * months);
}
