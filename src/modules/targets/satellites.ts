/**
 * Planetary moons bright enough to see in a small telescope, with their
 * positions relative to the planet at a given time.
 *
 * Jupiter's Galilean moons use the low-accuracy theory in J. Meeus,
 * "Astronomical Algorithms" (2nd ed.), chapter 44. CALCULATED; good to a few
 * hundredths of Jupiter's radius, far finer than the eye can tell. Eclipses
 * by Jupiter's shadow are not modelled. Pure functions, no DOM.
 */

export interface Satellite {
  name: string;
  /** Offset from the planet's centre in planet equatorial radii: west +, north +. */
  x: number;
  y: number;
  /** Nearer to us than the planet (true) or beyond it. */
  inFront: boolean;
  /** Hidden behind the disc, or lost against it while in transit. */
  hidden: boolean;
  /** Typical visual magnitude at opposition (RETRIEVED, rounded). */
  magnitude: number;
  /** Diameter in planet equatorial radii. */
  diameter: number;
}

const D2R = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * D2R);
const cos = (deg: number) => Math.cos(deg * D2R);

/** Julian Day (UT) of a JavaScript date. ΔT (~1 min) is ignored: Io moves < 0.2° in that time. */
export function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

const JUPITER_EQUATORIAL_KM = 71_492;
/** Jupiter's polar radius / equatorial radius. */
const JUPITER_FLATTENING = 0.9351;

const GALILEAN = [
  { name: "Io", magnitude: 5.0, diameterKm: 3643 },
  { name: "Europa", magnitude: 5.3, diameterKm: 3122 },
  { name: "Ganymede", magnitude: 4.6, diameterKm: 5268 },
  { name: "Callisto", magnitude: 5.6, diameterKm: 4821 },
] as const;

/** Positions of Io, Europa, Ganymede and Callisto (Meeus ch. 44, low accuracy). */
export function galileanMoons(date: Date): Satellite[] {
  const d = julianDay(date) - 2_451_545.0;
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
  const psi = Math.asin((R / delta) * sin(K)) / D2R;
  const t = d - delta / 173; // light time
  const lambda = 34.35 + 0.083091 * d + 0.329 * sin(V) + B;
  const Ds = 3.12 * sin(lambda + 42.8);
  const De = Ds - 2.22 * sin(psi) * cos(lambda + 22) - 1.3 * ((r - delta) / delta) * sin(lambda - 100.5);

  let u1 = 163.8069 + 203.4058646 * t + psi - B;
  let u2 = 358.414 + 101.2916335 * t + psi - B;
  let u3 = 5.7176 + 50.234518 * t + psi - B;
  let u4 = 224.8092 + 21.48798 * t + psi - B;
  const G = 331.18 + 50.310482 * t;
  const H = 87.45 + 21.569231 * t;
  const c1 = 0.473 * sin(2 * (u1 - u2));
  const c2 = 1.065 * sin(2 * (u2 - u3));
  const r1 = 5.9057 - 0.0244 * cos(2 * (u1 - u2));
  const r2 = 9.3966 - 0.0882 * cos(2 * (u2 - u3));
  const r3 = 14.9883 - 0.0216 * cos(G);
  const r4 = 26.3627 - 0.1939 * cos(H);
  u1 += c1;
  u2 += c2;
  u3 += 0.165 * sin(G);
  u4 += 0.843 * sin(H);

  return [
    [u1, r1],
    [u2, r2],
    [u3, r3],
    [u4, r4],
  ].map(([u, rad], i) => {
    const x = rad * sin(u);
    const y = -rad * cos(u) * sin(De);
    // u is measured from inferior conjunction: cos u > 0 is the near side.
    const inFront = cos(u) > 0;
    const onDisc = x * x + (y / JUPITER_FLATTENING) ** 2 < 1;
    const m = GALILEAN[i];
    return {
      name: m.name,
      x,
      y,
      inFront,
      hidden: onDisc,
      magnitude: m.magnitude,
      diameter: m.diameterKm / JUPITER_EQUATORIAL_KM,
    };
  });
}

/** Targets with moons we can place. */
export function hasSatellites(targetId: string): boolean {
  return targetId === "jupiter";
}

export function satellitesOf(targetId: string, date: Date): Satellite[] {
  return targetId === "jupiter" ? galileanMoons(date) : [];
}

export const SATELLITE_METHOD =
  "Positions calculated with the low-accuracy theory in Meeus, Astronomical Algorithms, ch. 44. Brightness is a typical value; eclipses by Jupiter's shadow are not shown.";
