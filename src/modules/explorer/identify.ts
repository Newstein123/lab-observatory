/**
 * Identification inside the telescope view. Feature positions come from
 * their coordinates and the computed orientation of the body for the
 * observation time and site — never from fixed hotspots — through the same
 * sky→screen mapping the view uses for everything else.
 *
 * Distinguishes three things (spec §9): what the setup actually resolves,
 * what is only identified by position, and (elsewhere) what is a separate
 * scientific reconstruction.
 */
import { projectSelenographic, type DiscPoint, type MoonOrientation } from "@/modules/sky/moon";
import type { RingFeature, SurfaceFeature } from "./types";

export type Orientation = "sky" | "diagonal" | "inverted";

/** Same mapping as components/lab/view-options `orient`: each orientation is its own inverse. */
function orient(o: Orientation, x: number, y: number) {
  if (o === "diagonal") return { x: -x, y };
  if (o === "inverted") return { x: -x, y: -y };
  return { x, y };
}

/** How the view is drawn: the same numbers SimulationViewport uses for its overlays. */
export interface ViewGeometry {
  width: number;
  height: number;
  /** Diameter of the body on screen, px. */
  targetPx: number;
  /** Offset of the body from the view centre, px, sky frame (before orientation). */
  panPx: { x: number; y: number };
  orientation: Orientation;
  /** Radius of the visible field, px (eyepiece circle); undefined for a rectangle filling the view. */
  fieldRadiusPx?: number;
}

/** Screen position (px from the view's top-left) of a point given in body radii, sky frame. */
export function toScreen(v: ViewGeometry, x: number, y: number) {
  const r = v.targetPx / 2;
  const p = orient(v.orientation, x * r + v.panPx.x, y * r + v.panPx.y);
  return { x: v.width / 2 + p.x, y: v.height / 2 + p.y };
}

/** Inverse of toScreen: body radii, sky frame. */
export function fromScreen(v: ViewGeometry, sx: number, sy: number) {
  const p = orient(v.orientation, sx - v.width / 2, sy - v.height / 2);
  const r = v.targetPx / 2;
  return { x: (p.x - v.panPx.x) / r, y: (p.y - v.panPx.y) / r };
}

function inView(v: ViewGeometry, sx: number, sy: number) {
  if (v.fieldRadiusPx !== undefined) return Math.hypot(sx - v.width / 2, sy - v.height / 2) <= v.fieldRadiusPx;
  return sx >= 0 && sy >= 0 && sx <= v.width && sy <= v.height;
}

export interface PlacedFeature {
  feature: SurfaceFeature;
  /** Screen position, px. */
  x: number;
  y: number;
  /** Approximate on-screen radius, px (foreshortening ignored). */
  radiusPx: number;
  /** On the hemisphere facing us tonight. */
  nearSide: boolean;
  /** In sunlight at the observation time. */
  lit: boolean;
  /** Inside the visible field. */
  inField: boolean;
  /** Distance from the disc centre, body radii (1 = limb). */
  limbDistance: number;
}

const MOON_RADIUS_KM = 1737.4;

/** Where a surface feature appears on the disc (body radii, sky frame). */
export type FeatureProjector = (f: SurfaceFeature) => DiscPoint;

/** Where each lunar feature is in the view tonight. */
export function placeLunarFeatures(features: readonly SurfaceFeature[], o: MoonOrientation, v: ViewGeometry): PlacedFeature[] {
  return placeFeatures(features, (f) => projectSelenographic(f.latDeg, f.lonDeg, o), MOON_RADIUS_KM, v);
}

/** Where each feature is in the view, for any body: `bodyRadiusKm` is the radius the disc is drawn at. */
export function placeFeatures(
  features: readonly SurfaceFeature[],
  project: FeatureProjector,
  bodyRadiusKm: number,
  v: ViewGeometry,
  radiusFraction?: (f: SurfaceFeature) => number,
): PlacedFeature[] {
  return features.map((feature) => {
    const d = project(feature);
    const s = toScreen(v, d.x, d.y);
    return {
      feature,
      x: s.x,
      y: s.y,
      radiusPx: (radiusFraction ? radiusFraction(feature) : feature.diameterKm / 2 / bodyRadiusKm) * (v.targetPx / 2),
      nearSide: d.z > 0,
      lit: d.sunDot > 0,
      inField: d.z > 0 && inView(v, s.x, s.y),
      // Foreshortening towards a limb applies to bodies, not to positions on the sky.
      limbDistance: radiusFraction ? 0 : Math.hypot(d.x, d.y),
    };
  });
}

/**
 * The feature at a screen point: the smallest feature whose outline contains
 * the point, otherwise the nearest feature centre within `tolerancePx`.
 */
export function featureAt(placed: readonly PlacedFeature[], sx: number, sy: number, tolerancePx = 14): PlacedFeature | undefined {
  let inside: PlacedFeature | undefined;
  let nearest: PlacedFeature | undefined;
  let nearestD = Infinity;
  for (const p of placed) {
    if (!p.nearSide) continue;
    const d = Math.hypot(sx - p.x, sy - p.y);
    // Outlines are foreshortened towards the limb; shrink the test radius to match roughly.
    const r = p.radiusPx * Math.sqrt(Math.max(0.05, 1 - p.limbDistance ** 2));
    if (d <= r && (!inside || p.feature.diameterKm < inside.feature.diameterKm)) inside = p;
    if (d < nearestD) {
      nearestD = d;
      nearest = p;
    }
  }
  if (inside) return inside;
  return nearestD <= tolerancePx ? nearest : undefined;
}

/**
 * Labels that fit without overlapping: by priority, then size. Far-side
 * features, features outside the field and features too small on screen to
 * mean anything at this scale are left out.
 */
export function chooseLabels(placed: readonly PlacedFeature[], opts: { minRadiusPx?: number; max?: number; always?: string[] } = {}): PlacedFeature[] {
  const { minRadiusPx = 3, max = 14, always = [] } = opts;
  const candidates = placed
    .filter((p) => p.inField && (always.includes(p.feature.id) || p.radiusPx >= minRadiusPx * p.feature.priority))
    .sort(
      (a, b) =>
        Number(always.includes(b.feature.id)) - Number(always.includes(a.feature.id)) ||
        a.feature.priority - b.feature.priority ||
        b.feature.diameterKm - a.feature.diameterKm,
    );
  const chosen: PlacedFeature[] = [];
  for (const c of candidates) {
    if (chosen.length >= max && !always.includes(c.feature.id)) break;
    // Labels are about 90×18 px; keep their anchors apart.
    if (chosen.some((o) => Math.abs(o.x - c.x) < 84 && Math.abs(o.y - c.y) < 22) && !always.includes(c.feature.id)) continue;
    chosen.push(c);
  }
  return chosen;
}

export type Resolvability = "resolved" | "at-limit" | "identified-by-position";

export interface Observability {
  resolvability: Resolvability;
  /** Angular size of the feature, arcsec. */
  angularArcsec: number;
  /** What limits detail: the optics' and seeing's resolution, arcsec. */
  resolutionArcsec: number;
  /** How large it looks through the eyepiece (angular size × magnification), arcsec; eyepiece only. */
  apparentArcsec?: number;
  /** Camera pixels across the feature; camera only. */
  pixelsAcross?: number;
}

/** The eye needs a feature to subtend about 1′ to see it at all and ~2′ to see its shape. */
const EYE_DETECT_ARCSEC = 60;
const EYE_SHAPE_ARCSEC = 120;

/**
 * Can this setup show the feature, or is it only identified by position?
 * Size comes from the feature's real diameter and the body's distance;
 * resolution from the simulation (max of Dawes limit and seeing).
 */
export function classifyObservability(
  diameterKm: number,
  distanceKm: number,
  setup: { resolutionArcsec: number; magnification?: number; imageScaleArcsecPerPx?: number },
): Observability {
  const angularArcsec = (diameterKm / distanceKm) * 206_264.806;
  const { resolutionArcsec, magnification, imageScaleArcsecPerPx } = setup;
  const apparentArcsec = magnification ? angularArcsec * magnification : undefined;
  const pixelsAcross = imageScaleArcsecPerPx ? angularArcsec / imageScaleArcsecPerPx : undefined;
  const bigEnough = (shape: boolean) => {
    if (apparentArcsec !== undefined) return apparentArcsec >= (shape ? EYE_SHAPE_ARCSEC : EYE_DETECT_ARCSEC);
    if (pixelsAcross !== undefined) return pixelsAcross >= (shape ? 4 : 2);
    return true;
  };
  let resolvability: Resolvability = "identified-by-position";
  if (angularArcsec >= 3 * resolutionArcsec && bigEnough(true)) resolvability = "resolved";
  else if (angularArcsec >= resolutionArcsec && bigEnough(false)) resolvability = "at-limit";
  return { resolvability, angularArcsec, resolutionArcsec, apparentArcsec, pixelsAcross };
}

// ── Rings ────────────────────────────────────────────────────────────────

/** How a ring system is seen: tilt towards us and the planet's axis angle. */
export interface RingGeometry {
  /** Ring opening: the observer's latitude above the ring plane, degrees. */
  tiltDeg: number;
  /** Position angle of the planet's north pole, degrees. */
  poleDeg: number;
  /** km per body radius (the target's catalogued semi-major axis, e.g. the A ring's outer edge). */
  unitKm: number;
  /** The globe's equatorial radius and polar flattening (polar/equatorial). */
  globeKm: number;
  globeRatio: number;
}

/** Sky frame (x west, y down) → planet frame (x along the equator, y along the projected axis, down = south). */
function toPlanetFrame(x: number, y: number, poleDeg: number) {
  const t = (poleDeg * Math.PI) / 180;
  return { x: x * Math.cos(t) - y * Math.sin(t), y: x * Math.sin(t) + y * Math.cos(t) };
}
function fromPlanetFrame(x: number, y: number, poleDeg: number) {
  return toPlanetFrame(x, y, -poleDeg);
}

export interface PlacedRing {
  ring: RingFeature;
  /** Label anchor on screen: the ring's middle at one ansa. */
  x: number;
  y: number;
  side: "west" | "east";
}

/**
 * Label anchors at the ring ends (ansae), where the rings and their gaps are
 * seen best: the A ring and Cassini Division on the west, B and C on the
 * east, so labels do not pile up.
 */
export function placeRings(rings: readonly RingFeature[], g: RingGeometry, v: ViewGeometry): PlacedRing[] {
  const west = new Set(["a-ring", "cassini-division", "encke-gap", "f-ring"]);
  return rings.map((ring) => {
    const side = west.has(ring.id) ? "west" : "east";
    const rho = (ring.innerKm + ring.outerKm) / 2 / g.unitKm;
    const p = fromPlanetFrame(side === "west" ? rho : -rho, 0, g.poleDeg);
    const s = toScreen(v, p.x, p.y);
    return { ring, x: s.x, y: s.y, side };
  });
}

/**
 * What is at a point over a ringed planet: a ring (by its distance from the
 * centre in the ring plane), the globe, or nothing. Where the rings pass in
 * front of the globe the ring wins.
 */
export function ringAt(rings: readonly RingFeature[], g: RingGeometry, v: ViewGeometry, sx: number, sy: number): RingFeature | "globe" | undefined {
  const q = fromScreen(v, sx, sy);
  const u = toPlanetFrame(q.x, q.y, g.poleDeg);
  const sinB = Math.sin((g.tiltDeg * Math.PI) / 180);
  let rhoKm: number | undefined;
  if (Math.abs(sinB) > 0.03) rhoKm = Math.hypot(u.x, u.y / sinB) * g.unitKm;
  else if (Math.abs(u.y) * g.unitKm < 3000) rhoKm = Math.abs(u.x) * g.unitKm; // nearly edge-on: only along the line
  // The narrowest ring or gap containing the point.
  const hit = rhoKm === undefined ? undefined : [...rings].sort((a, b) => a.outerKm - a.innerKm - (b.outerKm - b.innerKm)).find((r) => rhoKm! >= r.innerKm && rhoKm! <= r.outerKm);
  const gx = (u.x * g.unitKm) / g.globeKm;
  const gy = (u.y * g.unitKm) / (g.globeKm * g.globeRatio);
  const onGlobe = gx * gx + gy * gy <= 1;
  if (onGlobe) {
    // The near half of the rings crosses in front of the globe: south of centre when we see the north face (B > 0).
    const ringInFront = hit && u.y * Math.sign(g.tiltDeg || 1) > 0;
    return ringInFront ? hit : "globe";
  }
  return hit;
}
