/**
 * Elevation crops around landmarks (LOLA 118 m, see lunar/assets.json) and
 * measurements made from them. Values derived here are CALCULATED from the
 * measured topography: they depend on the method below, which is stated
 * with them.
 */
import { terrainAssets } from "./lunar/assets";

export interface Terrain {
  featureId: string;
  /** Samples per side; the grid is n × n, row-major from the north-west corner. */
  n: number;
  sideKm: number;
  kmPerSample: number;
  /** Metres above the 1737.4 km reference sphere. */
  elevation: Int16Array;
  minM: number;
  maxM: number;
  albedoSrc: string;
}

const cache = new Map<string, Promise<Terrain>>();

export function loadTerrain(featureId: string): Promise<Terrain> {
  let p = cache.get(featureId);
  if (!p) {
    const a = terrainAssets(featureId);
    if (!a?.dem.window) return Promise.reject(new Error(`No terrain for ${featureId}`));
    const w = a.dem.window;
    p = fetch(a.dem.src)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => ({
        featureId,
        n: w.samples,
        sideKm: w.sideKm,
        kmPerSample: w.kmPerSample,
        elevation: new Int16Array(buf),
        minM: a.dem.minM ?? 0,
        maxM: a.dem.maxM ?? 0,
        albedoSrc: a.albedo.src,
      }));
    p.catch(() => cache.delete(featureId));
    cache.set(featureId, p);
  }
  return p;
}

/** Elevation (m) at a point given in km from the centre (x east, y north); bilinear. */
export function elevationAt(t: Pick<Terrain, "n" | "sideKm" | "elevation">, xKm: number, yKm: number): number {
  const { n, sideKm, elevation } = t;
  const fx = (xKm / sideKm + 0.5) * n - 0.5;
  const fy = (0.5 - yKm / sideKm) * n - 0.5;
  const x0 = Math.max(0, Math.min(n - 2, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(n - 2, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const e = (x: number, y: number) => elevation[y * n + x];
  return (1 - ty) * ((1 - tx) * e(x0, y0) + tx * e(x0 + 1, y0)) + ty * ((1 - tx) * e(x0, y0 + 1) + tx * e(x0 + 1, y0 + 1));
}

export interface ProfilePoint {
  /** Distance along the line from its start, km. */
  dKm: number;
  elevationM: number;
}

/** Elevation along a line through the centre at an azimuth (degrees from north through east). */
export function profile(t: Terrain, azimuthDeg: number, lengthKm = t.sideKm * 0.95, samples = 240): ProfilePoint[] {
  const a = (azimuthDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = Math.cos(a);
  return Array.from({ length: samples }, (_, i) => {
    const s = (i / (samples - 1) - 0.5) * lengthKm;
    return { dKm: s + lengthKm / 2, elevationM: elevationAt(t, s * dx, s * dy) };
  });
}

export interface CraterMetrics {
  /** Mean rim crest elevation, m. */
  rimM: number;
  /** Floor elevation (5th percentile inside 0.35 D), m. */
  floorM: number;
  /** Rim-to-floor depth, m. */
  depthM: number;
  /** Radius of the rim crest, km (mean over azimuths). */
  rimRadiusKm: number;
  /** Highest point near the centre above the floor, m; undefined if there is no clear central peak. */
  centralPeakM?: number;
  method: string;
}

/**
 * Rim height, floor and depth of a crater from its elevation crop: along 72
 * radial lines, the rim crest is the highest point between 0.35 and 0.75
 * diameters from the centre; the floor is the 5th percentile of elevations
 * inside 0.35 diameters. CALCULATED.
 */
export function craterMetrics(t: Terrain, diameterKm: number): CraterMetrics {
  const rims: { r: number; e: number }[] = [];
  const step = t.kmPerSample / 2;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * 2 * Math.PI;
    let best = { r: 0, e: -Infinity };
    for (let r = 0.35 * diameterKm; r <= Math.min(0.75 * diameterKm, t.sideKm / 2 - step); r += step) {
      const e = elevationAt(t, r * Math.sin(a), r * Math.cos(a));
      if (e > best.e) best = { r, e };
    }
    rims.push(best);
  }
  const rimM = rims.reduce((s, x) => s + x.e, 0) / rims.length;
  const rimRadiusKm = rims.reduce((s, x) => s + x.r, 0) / rims.length;

  const inner: number[] = [];
  let peak = -Infinity;
  for (let y = -0.35 * diameterKm; y <= 0.35 * diameterKm; y += step) {
    for (let x = -0.35 * diameterKm; x <= 0.35 * diameterKm; x += step) {
      const r = Math.hypot(x, y);
      if (r > 0.35 * diameterKm) continue;
      const e = elevationAt(t, x, y);
      inner.push(e);
      if (r <= 0.15 * diameterKm && e > peak) peak = e;
    }
  }
  inner.sort((a, b) => a - b);
  const floorM = inner[Math.floor(inner.length * 0.05)];
  const median = inner[Math.floor(inner.length / 2)];
  // A central peak: a clear rise near the centre above the general floor level.
  const centralPeakM = peak - median > 250 ? peak - floorM : undefined;
  return {
    rimM,
    floorM,
    depthM: rimM - floorM,
    rimRadiusKm,
    centralPeakM,
    method: "From LOLA 118 m elevation: mean of the highest point on 72 radial lines (rim) minus the 5th-percentile elevation inside 0.35 D (floor).",
  };
}
