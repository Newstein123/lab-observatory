/**
 * The Moon: position (Meeus ch. 47, the main periodic terms: about 0.05° in
 * longitude), distance, apparent size, phase (Meeus ch. 48), the bright limb's
 * position angle, and lunation events. CALCULATED.
 */
import { eclipticToEquatorial, hourAngle, positionAngle, type Equatorial, type Site } from "./coords";
import { acos, asin, atan2, AU_KM, cos, norm180, norm360, sin, tan } from "./math";
import { sunPosition } from "./sun";
import { julianCenturies, obliquity } from "./time";

/** Mean Moon radius, km. */
const MOON_RADIUS_KM = 1737.4;
const EARTH_RADIUS_KM = 6378.14;
export const SYNODIC_MONTH_DAYS = 29.530588853;

// Meeus table 47.A: D, M, M′, F, Σl (1e-6°), Σr (1e-3 km). Terms below ~0.002° omitted.
const LR: readonly (readonly [number, number, number, number, number, number])[] = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
];

// Meeus table 47.B: D, M, M′, F, Σb (1e-6°).
const B: readonly (readonly [number, number, number, number, number])[] = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
];

export interface MoonPosition extends Equatorial {
  /** Ecliptic longitude and latitude (mean equinox of date), degrees. */
  lonDeg: number;
  latDeg: number;
  distanceKm: number;
}

/** Geocentric position of the Moon. */
/** Fundamental arguments (Meeus 47.1–47.5), degrees, for Julian centuries t. */
function moonArguments(t: number) {
  return {
    lp: norm360(218.3164477 + 481267.88123421 * t - 0.0015786 * t * t + t ** 3 / 538841 - t ** 4 / 65194000),
    d: norm360(297.8501921 + 445267.1114034 * t - 0.0018819 * t * t + t ** 3 / 545868 - t ** 4 / 113065000),
    m: norm360(357.5291092 + 35999.0502909 * t - 0.0001536 * t * t + t ** 3 / 24490000),
    mp: norm360(134.9633964 + 477198.8675055 * t + 0.0087414 * t * t + t ** 3 / 69699 - t ** 4 / 14712000),
    f: norm360(93.272095 + 483202.0175233 * t - 0.0036539 * t * t - t ** 3 / 3526000 + t ** 4 / 863310000),
  };
}

export function moonPosition(date: Date): MoonPosition {
  const t = julianCenturies(date);
  const { lp, d, m, mp, f } = moonArguments(t);
  const a1 = 119.75 + 131.849 * t;
  const a2 = 53.09 + 479264.29 * t;
  const a3 = 313.45 + 481266.484 * t;
  const e = 1 - 0.002516 * t - 0.0000074 * t * t;
  const eFactor = (mm: number) => (Math.abs(mm) === 1 ? e : Math.abs(mm) === 2 ? e * e : 1);

  let sl = 0;
  let sr = 0;
  for (const [cd, cm, cmp, cf, l, r] of LR) {
    const arg = cd * d + cm * m + cmp * mp + cf * f;
    sl += l * eFactor(cm) * sin(arg);
    sr += r * eFactor(cm) * cos(arg);
  }
  let sb = 0;
  for (const [cd, cm, cmp, cf, b] of B) sb += b * eFactor(cm) * sin(cd * d + cm * m + cmp * mp + cf * f);

  sl += 3958 * sin(a1) + 1962 * sin(lp - f) + 318 * sin(a2);
  sb += -2235 * sin(lp) + 382 * sin(a3) + 175 * sin(a1 - f) + 175 * sin(a1 + f) + 127 * sin(lp - mp) - 115 * sin(lp + mp);

  const lon = norm360(lp + sl / 1e6);
  const lat = sb / 1e6;
  const distanceKm = 385000.56 + sr / 1000;
  return { ...eclipticToEquatorial(lon, lat, obliquity(t)), lonDeg: lon, latDeg: lat, distanceKm };
}

/**
 * Topocentric position: the Moon is close enough that where you stand on
 * Earth shifts it by up to about 1° (Meeus ch. 40; sea level, spherical-ish Earth).
 */
export function topocentric(eq: Equatorial, distanceKm: number, site: Site, date: Date): Equatorial {
  const sinPi = EARTH_RADIUS_KM / distanceKm;
  const rhoCos = cos(site.latDeg);
  const rhoSin = 0.99664719 * sin(site.latDeg);
  const h = hourAngle(eq, site, date);
  const dRa = atan2(-rhoCos * sinPi * sin(h), cos(eq.decDeg) - rhoCos * sinPi * cos(h));
  const dec = atan2((sin(eq.decDeg) - rhoSin * sinPi) * cos(dRa), cos(eq.decDeg) - rhoCos * sinPi * cos(h));
  return { raDeg: norm360(eq.raDeg + dRa), decDeg: dec };
}

export type MoonPhaseName =
  | "New Moon"
  | "Waxing crescent"
  | "First quarter"
  | "Waxing gibbous"
  | "Full Moon"
  | "Waning gibbous"
  | "Last quarter"
  | "Waning crescent";

export interface MoonPhase {
  /** Sun–Moon–Earth angle, degrees (0 full, 180 new). */
  phaseAngleDeg: number;
  /** Fraction of the disc lit, 0…1. */
  illuminated: number;
  /** Position angle of the bright limb's midpoint, from north through east, degrees. */
  brightLimbDeg: number;
  waxing: boolean;
  /** Days since new Moon. */
  ageDays: number;
  name: MoonPhaseName;
  /** Apparent diameter, arcseconds. */
  diameterArcsec: number;
  /** Visual magnitude (Allen; ignores the opposition surge). */
  magnitude: number;
}

/** Phase and appearance of the Moon (Meeus ch. 48). */
export function moonPhase(date: Date): MoonPhase {
  const moon = moonPosition(date);
  const sun = sunPosition(date);
  const elongation = acos(sin(sun.decDeg) * sin(moon.decDeg) + cos(sun.decDeg) * cos(moon.decDeg) * cos(sun.raDeg - moon.raDeg));
  const rKm = sun.distanceAu * AU_KM;
  const i = norm360(atan2(rKm * sin(elongation), moon.distanceKm - rKm * cos(elongation)));
  const illuminated = (1 + cos(i)) / 2;
  const brightLimbDeg = positionAngle(moon, sun);
  const lonDiff = norm360(moon.lonDeg - sun.lonDeg);
  const waxing = lonDiff < 180;
  const ageDays = (lonDiff / 360) * SYNODIC_MONTH_DAYS;
  return {
    phaseAngleDeg: i,
    illuminated,
    brightLimbDeg,
    waxing,
    ageDays,
    name: phaseName(lonDiff),
    diameterArcsec: 2 * asin(MOON_RADIUS_KM / moon.distanceKm) * 3600,
    magnitude: -12.73 + 0.026 * i + 4e-9 * i ** 4,
  };
}

/** Name from the Moon–Sun longitude difference (0 new, 90 first quarter, 180 full, 270 last quarter). */
function phaseName(lonDiff: number): MoonPhaseName {
  // Quarters and new/full are named within ±6° (about half a day) of the exact moment.
  const near = (target: number) => Math.abs(norm180(lonDiff - target)) <= 6;
  if (near(0)) return "New Moon";
  if (near(90)) return "First quarter";
  if (near(180)) return "Full Moon";
  if (near(270)) return "Last quarter";
  if (lonDiff < 90) return "Waxing crescent";
  if (lonDiff < 180) return "Waxing gibbous";
  if (lonDiff < 270) return "Waning gibbous";
  return "Waning crescent";
}

/** The next moment the Moon–Sun longitude difference reaches `targetDeg` (0 new, 180 full). */
export function nextLunarPhase(from: Date, targetDeg: 0 | 90 | 180 | 270): Date {
  const diff = (d: Date) => norm180(norm360(moonPosition(d).lonDeg - sunPosition(d).lonDeg) - targetDeg);
  // The difference grows about 12.2° a day: step 1 day until it crosses from − to +, then bisect.
  let a = from.getTime();
  let fa = diff(from);
  for (let i = 0; i < 32; i++) {
    const b = a + 86_400_000;
    const fb = diff(new Date(b));
    if (fa < 0 && fb >= 0) {
      let lo = a;
      let hi = b;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (diff(new Date(mid)) < 0) lo = mid;
        else hi = mid;
      }
      return new Date(Math.round((lo + hi) / 2));
    }
    a = b;
    fa = fb;
  }
  return new Date(from.getTime() + SYNODIC_MONTH_DAYS * 86_400_000);
}

/** Inclination of the mean lunar equator to the ecliptic (Meeus ch. 53), degrees. */
const LUNAR_I = 1.54242;

export interface MoonOrientation {
  /** Selenographic longitude of the point facing the observer (libration in longitude), degrees, east-positive. */
  librationLonDeg: number;
  /** Selenographic latitude of the point facing the observer (libration in latitude), degrees. */
  librationLatDeg: number;
  /** Position angle of the Moon's north pole, from celestial north through east, degrees. */
  axisPaDeg: number;
  /** Selenographic latitude and longitude of the sub-solar point, degrees. */
  subSolarLatDeg: number;
  subSolarLonDeg: number;
}

/**
 * Selenographic coordinates (Meeus 53.1 with the physical libration terms of
 * ch. 53) of the point of the Moon on the line to a body at ecliptic
 * longitude/latitude λ, β as seen from the Moon's centre.
 */
function librations(lambda: number, beta: number, a: ReturnType<typeof moonArguments>, t: number) {
  const { d, m, mp, f } = a;
  const om = norm360(125.0445479 - 1934.1362891 * t + 0.0020754 * t * t + t ** 3 / 467441 - t ** 4 / 60616000);
  const e = 1 - 0.002516 * t - 0.0000074 * t * t;
  const k1 = 119.75 + 131.849 * t;
  const k2 = 72.56 + 20.186 * t;
  const w = lambda - om;
  const aa = atan2(sin(w) * cos(beta) * cos(LUNAR_I) - sin(beta) * sin(LUNAR_I), cos(w) * cos(beta));
  const lOpt = norm180(aa - f);
  const bOpt = asin(-sin(w) * cos(beta) * sin(LUNAR_I) - sin(beta) * cos(LUNAR_I));
  const rho =
    -0.02752 * cos(mp) - 0.02245 * sin(f) + 0.00684 * cos(mp - 2 * f) - 0.00293 * cos(2 * f) - 0.00085 * cos(2 * f - 2 * d) -
    0.00054 * cos(mp - 2 * d) - 0.0002 * sin(mp + f) - 0.0002 * cos(mp + 2 * f) - 0.0002 * cos(mp - f) + 0.00014 * cos(mp + 2 * f - 2 * d);
  const sigma =
    -0.02816 * sin(mp) + 0.02244 * cos(f) - 0.00682 * sin(mp - 2 * f) - 0.00279 * sin(2 * f) - 0.00083 * sin(2 * f - 2 * d) +
    0.00069 * sin(mp - 2 * d) + 0.0004 * cos(mp + f) - 0.00025 * sin(2 * mp) - 0.00023 * sin(mp + 2 * f) + 0.0002 * cos(mp - f) +
    0.00019 * sin(mp - f) + 0.00013 * sin(mp + 2 * f - 2 * d) - 0.0001 * cos(mp - 3 * f);
  const tau =
    0.0252 * e * sin(m) + 0.00473 * sin(2 * mp - 2 * f) - 0.00467 * sin(mp) + 0.00396 * sin(k1) + 0.00276 * sin(2 * mp - 2 * d) +
    0.00196 * sin(om) - 0.00183 * cos(mp - f) + 0.00115 * sin(mp - 2 * d) - 0.00096 * sin(mp - d) + 0.00046 * sin(2 * f - 2 * d) -
    0.00039 * sin(mp - f) - 0.00032 * sin(mp - m - d) + 0.00027 * sin(2 * mp - m - 2 * d) + 0.00023 * sin(k2) - 0.00014 * sin(2 * d) +
    0.00014 * cos(2 * mp - 2 * f) - 0.00012 * sin(mp - 2 * f) - 0.00012 * sin(2 * mp) + 0.00011 * sin(2 * mp - 2 * m - 2 * d);
  const lPhys = -tau + (rho * cos(aa) + sigma * sin(aa)) * tan(bOpt);
  const bPhys = sigma * sin(aa) - rho * cos(aa);
  return { l: norm180(lOpt + lPhys), b: bOpt + bPhys, om, rho, sigma };
}

/**
 * How the Moon is turned towards us: libration (which part of the surface
 * faces the observer), the position angle of its axis, and where the Sun is
 * overhead. Meeus ch. 53; with a site, the topocentric corrections (up to
 * about 1°) are applied. Accuracy about 0.05°, limited by the low-precision
 * lunar theory (nutation is ignored). CALCULATED.
 */
export function moonOrientation(date: Date, site?: Site): MoonOrientation {
  const t = julianCenturies(date);
  const args = moonArguments(t);
  const moon = moonPosition(date);
  const lib = librations(moon.lonDeg, moon.latDeg, args, t);

  // Position angle of the axis (Meeus 53.3).
  const eps = obliquity(t);
  const v = lib.om + lib.sigma / sin(LUNAR_I);
  const x = sin(LUNAR_I + lib.rho) * sin(v);
  const y = sin(LUNAR_I + lib.rho) * cos(v) * cos(eps) - cos(LUNAR_I + lib.rho) * sin(eps);
  const omega = atan2(x, y);
  let p = asin((Math.hypot(x, y) * cos(moon.raDeg - omega)) / cos(lib.b));
  let l = lib.l;
  let b = lib.b;

  if (site) {
    // Topocentric corrections (Meeus ch. 53, "topocentric librations").
    const h = hourAngle(moon, site, date);
    const q = atan2(cos(site.latDeg) * sin(h), cos(moon.decDeg) * sin(site.latDeg) - sin(moon.decDeg) * cos(site.latDeg) * cos(h));
    const z = acos(sin(moon.decDeg) * sin(site.latDeg) + cos(moon.decDeg) * cos(site.latDeg) * cos(h));
    const parallax = asin(EARTH_RADIUS_KM / moon.distanceKm);
    const pp = parallax * (sin(z) + 0.0084 * sin(2 * z));
    const dl = (-pp * sin(q - p)) / cos(b);
    const db = pp * cos(q - p);
    const dp = dl * sin(b + db) - pp * sin(q) * Math.tan((moon.decDeg * Math.PI) / 180);
    l = norm180(l + dl);
    b += db;
    p += dp;
  }

  // Sub-solar point: the same formulas for the Sun seen from the Moon (Meeus 53, "selenographic position of the Sun").
  const sun = sunPosition(date);
  const ratio = moon.distanceKm / (sun.distanceAu * AU_KM);
  const lambdaH = sun.lonDeg + 180 + ratio * (180 / Math.PI) * cos(moon.latDeg) * sin(sun.lonDeg - moon.lonDeg);
  const betaH = ratio * moon.latDeg;
  const sub = librations(lambdaH, betaH, args, t);

  return { librationLonDeg: l, librationLatDeg: b, axisPaDeg: norm360(p), subSolarLatDeg: sub.b, subSolarLonDeg: sub.l };
}

/** A selenographic point projected onto the Moon's disc. */
export interface DiscPoint {
  /**
   * Position in Moon radii in the sky frame used by the renderers: celestial
   * north up, east left, y growing downwards (canvas convention).
   */
  x: number;
  y: number;
  /** Towards the observer when > 0: the point is on the visible hemisphere. */
  z: number;
  /** Cosine of the Sun's zenith angle at the point: lit when > 0. */
  sunDot: number;
}

/** Unit vector of a selenographic point, in a frame where (lat0, lon0) faces +z and lunar north is +y. */
function facing(latDeg: number, lonDeg: number, lat0: number, lon0: number) {
  const dl = lonDeg - lon0;
  return {
    x: cos(latDeg) * sin(dl),
    y: cos(lat0) * sin(latDeg) - sin(lat0) * cos(latDeg) * cos(dl),
    z: sin(lat0) * sin(latDeg) + cos(lat0) * cos(latDeg) * cos(dl),
  };
}

/**
 * Orthographic projection of a selenographic point (east-positive longitude)
 * onto the disc as seen with this orientation. The single source of truth for
 * both the drawn Moon image and the feature labels.
 */
export function projectSelenographic(latDeg: number, lonDeg: number, o: MoonOrientation): DiscPoint {
  const v = facing(latDeg, lonDeg, o.librationLatDeg, o.librationLonDeg);
  // Lunar east (towards Mare Crisium) is on the sky's west side: screen right.
  const r = rotateAxis(v.x, -v.y, o.axisPaDeg);
  const s = facing(latDeg, lonDeg, o.subSolarLatDeg, o.subSolarLonDeg);
  return { x: r.x, y: r.y, z: v.z, sunDot: s.z };
}

/**
 * Inverse of projectSelenographic for a point on the disc (Moon radii, sky
 * frame); undefined off the disc.
 */
export function unprojectDisc(x: number, y: number, o: MoonOrientation): { latDeg: number; lonDeg: number } | undefined {
  const u = rotateAxis(x, y, -o.axisPaDeg);
  return unprojectLunarNorthUp(u.x, u.y, o);
}

/** Inverse projection for a disc drawn with lunar north up (before the axis turn). */
export function unprojectLunarNorthUp(x: number, yDown: number, o: Pick<MoonOrientation, "librationLatDeg" | "librationLonDeg">) {
  const yUp = -yDown;
  const rr = x * x + yUp * yUp;
  if (rr > 1) return undefined;
  const z = Math.sqrt(1 - rr);
  const b = o.librationLatDeg;
  const latDeg = asin(yUp * cos(b) + z * sin(b));
  const lonDeg = norm180(o.librationLonDeg + atan2(x, z * cos(b) - yUp * sin(b)));
  return { latDeg, lonDeg };
}

/**
 * Turn a point (canvas frame, y down) so that lunar north points paDeg
 * counter-clockwise from screen-up: the same turn drawTarget applies for
 * `rotationDeg`.
 */
function rotateAxis(x: number, y: number, paDeg: number) {
  const c = cos(-paDeg);
  const s = sin(-paDeg);
  return { x: x * c - y * s, y: x * s + y * c };
}
