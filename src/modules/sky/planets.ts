/**
 * Planet positions from JPL's approximate Keplerian elements (E. M. Standish,
 * "Keplerian Elements for Approximate Positions of the Major Planets", table 1,
 * valid 1800–2050), with magnitudes from Mallama & Hilton (2018).
 *
 * CALCULATED. Accuracy is about an arcminute for the inner planets and up to
 * ~10′ for Saturn: ample for where to look and how high, not for occultations.
 * Light time and aberration are ignored (< 1′).
 */
import { eclipticToEquatorial, positionAngle, precessFromJ2000, type Equatorial } from "./coords";
import { acos, asin, atan2, cos, norm360, sin } from "./math";
import { sunPosition } from "./sun";
import { julianCenturies } from "./time";

export type PlanetId = "mercury" | "venus" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune";

/** a (AU), e, I, L, ϖ (long. of perihelion), Ω (long. of node) and their rates per century. */
type Elements = readonly [number, number, number, number, number, number];
const ELEMENTS: Record<PlanetId | "earth", { at: Elements; rate: Elements }> = {
  mercury: { at: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  venus: { at: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418] },
  earth: { at: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0] },
  mars: { at: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  jupiter: { at: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  saturn: { at: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
  uranus: { at: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
  neptune: { at: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
};

/** Equatorial diameter at 1 AU, arcseconds, and polar/equatorial ratio. */
const SIZE: Record<PlanetId, { d1: number; flattening: number }> = {
  mercury: { d1: 6.74, flattening: 1 },
  venus: { d1: 16.92, flattening: 1 },
  mars: { d1: 9.36, flattening: 0.994 },
  jupiter: { d1: 196.94, flattening: 0.935 },
  saturn: { d1: 165.6, flattening: 0.902 },
  uranus: { d1: 70.48, flattening: 0.977 },
  neptune: { d1: 68.3, flattening: 0.983 },
};

/** Saturn's ring system, outer edge of the A ring / equatorial radius of the globe. */
const SATURN_RING_RATIO = 2.27;
/** Saturn's north pole, J2000. */
const SATURN_POLE: Equatorial = { raDeg: 40.589, decDeg: 83.537 };

/** Heliocentric ecliptic J2000 coordinates, AU. */
function heliocentric(id: PlanetId | "earth", t: number): [number, number, number] {
  const { at, rate } = ELEMENTS[id];
  const [a, e, inc, l, varpi, node] = at.map((v, i) => v + rate[i] * t);
  const omega = varpi - node;
  const m = norm360(l - varpi + 180) - 180;
  // Kepler's equation, Newton's method (degrees).
  const eDeg = (e * 180) / Math.PI;
  let ea = m + eDeg * sin(m);
  for (let i = 0; i < 12; i++) {
    const dm = m - (ea - eDeg * sin(ea));
    const de = dm / (1 - e * cos(ea));
    ea += de;
    if (Math.abs(de) < 1e-8) break;
  }
  const xp = a * (cos(ea) - e);
  const yp = a * Math.sqrt(1 - e * e) * sin(ea);
  const [co, so, cn, sn, ci, si] = [cos(omega), sin(omega), cos(node), sin(node), cos(inc), sin(inc)];
  return [
    (co * cn - so * sn * ci) * xp + (-so * cn - co * sn * ci) * yp,
    (co * sn + so * cn * ci) * xp + (-so * sn + co * cn * ci) * yp,
    so * si * xp + co * si * yp,
  ];
}

export interface PlanetPosition extends Equatorial {
  /** Distance from Earth and from the Sun, AU. */
  distanceAu: number;
  sunDistanceAu: number;
  /** Sun–planet–Earth angle, degrees. */
  phaseAngleDeg: number;
  /** Fraction of the disc lit, 0…1. */
  illuminated: number;
  /** Position angle of the bright limb, degrees. */
  brightLimbDeg: number;
  /** Equatorial and polar diameter, arcseconds (Saturn: the rings' width and apparent height). */
  majorArcsec: number;
  minorArcsec: number;
  /** Visual magnitude. */
  magnitude: number;
  /** Saturn only: tilt of the rings towards us, degrees. */
  ringTiltDeg?: number;
}

/** Apparent position and appearance of a planet (equinox of date). */
export function planetPosition(id: PlanetId, date: Date): PlanetPosition {
  const t = julianCenturies(date);
  const p = heliocentric(id, t);
  const earth = heliocentric("earth", t);
  const g = [p[0] - earth[0], p[1] - earth[1], p[2] - earth[2]];
  const delta = Math.hypot(...g);
  const r = Math.hypot(...p);
  const rEarth = Math.hypot(...earth);
  const lon = atan2(g[1], g[0]);
  const lat = asin(g[2] / delta);
  const j2000 = eclipticToEquatorial(lon, lat, 23.43928);
  const eq = precessFromJ2000(j2000, t);
  const i = acos((r * r + delta * delta - rEarth * rEarth) / (2 * r * delta));
  const { d1, flattening } = SIZE[id];
  const diameter = d1 / delta;
  let majorArcsec = diameter;
  let minorArcsec = diameter * flattening;
  let ringTiltDeg: number | undefined;
  if (id === "saturn") {
    // Earth's latitude above the ring plane (seen from Saturn, Earth is in the opposite direction).
    const sinB = -sin(SATURN_POLE.decDeg) * sin(j2000.decDeg) - cos(SATURN_POLE.decDeg) * cos(j2000.decDeg) * cos(SATURN_POLE.raDeg - j2000.raDeg);
    ringTiltDeg = asin(sinB);
    majorArcsec = diameter * SATURN_RING_RATIO;
    minorArcsec = Math.max(diameter * flattening, majorArcsec * Math.abs(sinB));
  }
  return {
    ...eq,
    distanceAu: delta,
    sunDistanceAu: r,
    phaseAngleDeg: i,
    illuminated: (1 + cos(i)) / 2,
    brightLimbDeg: positionAngle(eq, sunPosition(date)),
    majorArcsec,
    minorArcsec,
    magnitude: magnitude(id, i, r, delta, ringTiltDeg),
    ringTiltDeg,
  };
}

/** Mallama & Hilton (2018) visual magnitudes (simplified where noted). */
function magnitude(id: PlanetId, i: number, r: number, delta: number, ringTiltDeg = 0): number {
  const dist = 5 * Math.log10(r * delta);
  switch (id) {
    case "mercury":
      return -0.613 + 6.328e-2 * i - 1.6336e-3 * i ** 2 + 3.3644e-5 * i ** 3 - 3.4265e-7 * i ** 4 + 1.6893e-9 * i ** 5 - 3.0334e-12 * i ** 6 + dist;
    case "venus":
      return i < 163.7 ? -4.384 - 1.044e-3 * i + 3.687e-4 * i ** 2 - 2.814e-6 * i ** 3 + 8.938e-9 * i ** 4 + dist : 236.05828 - 2.81914 * i + 8.39034e-3 * i ** 2 + dist;
    case "mars":
      return -1.601 + 2.267e-2 * i - 1.302e-4 * i ** 2 + dist;
    case "jupiter":
      return -9.395 - 3.7e-4 * i + 6.16e-4 * i ** 2 + dist;
    case "saturn":
      // Globe and rings together; the rings brighten Saturn as they open.
      return -8.914 - 1.825 * Math.abs(sin(ringTiltDeg)) + 0.026 * i + dist;
    case "uranus":
      return -7.11 + 6.587e-3 * i + 1.045e-4 * i ** 2 + dist;
    case "neptune":
      return -7.0 + dist;
  }
}

/** North poles of rotation, J2000 (IAU WGCCRE 2015). */
const POLES: Partial<Record<PlanetId, Equatorial>> = {
  mars: { raDeg: 317.681, decDeg: 52.887 },
  jupiter: { raDeg: 268.057, decDeg: 64.495 },
  saturn: { raDeg: 40.589, decDeg: 83.537 },
  uranus: { raDeg: 257.311, decDeg: -15.175 },
  neptune: { raDeg: 299.36, decDeg: 43.46 },
};

/**
 * Position angle of a planet's north pole on the sky (from celestial north
 * through east), degrees: how far its equator, belts, rings and moons' line are
 * turned from east–west. CALCULATED. Undefined for bodies we don't orient.
 */
export function poleAngleDeg(id: string, date: Date): number | undefined {
  if (!isPlanet(id)) return undefined;
  const pole = POLES[id];
  if (!pole) return undefined;
  return positionAngle(planetPosition(id, date), precessFromJ2000(pole, julianCenturies(date)));
}

export const PLANET_IDS: readonly PlanetId[] = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"];
export const isPlanet = (id: string): id is PlanetId => (PLANET_IDS as readonly string[]).includes(id);
