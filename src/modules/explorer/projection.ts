/**
 * How an object's surface features and rings map onto its disc at a given
 * time and place: one place for the view, the side panel and the strip to
 * agree on.
 */
import { grsLongitude, jupiterOrientation, projectJovian, type JupiterOrientation } from "@/modules/sky/jupiter";
import { moonOrientation, projectSelenographic, type MoonOrientation } from "@/modules/sky/moon";
import { planetPosition, poleAngleDeg, SATURN_RADIUS_KM, SATURN_RING_RATIO } from "@/modules/sky/planets";
import type { Site } from "@/modules/sky/coords";
import type { FeatureProjector, RingGeometry } from "./identify";
import type { ExplorerObject } from "./types";

export interface GrsMeasurement {
  lonDeg: number;
  atIso: string;
}

export interface SurfaceGeometry {
  project?: FeatureProjector;
  /** Radius the disc is drawn at, km (the target's catalogued semi-major axis). */
  bodyRadiusKm: number;
  rings?: RingGeometry;
  /** A feature's radius as a fraction of the body's radius (default: diameterKm / 2 / bodyRadiusKm). */
  featureRadius?: (f: import("./types").SurfaceFeature) => number;
  /** Point-like features (stars) get labels whatever their size on screen. */
  pointFeatures?: boolean;
  moon?: MoonOrientation;
  jupiter?: JupiterOrientation & { grsLonDeg: number; grsSource: "model" | "measured" };
}

export function surfaceGeometry(object: ExplorerObject, date: Date, site?: Site, grs?: GrsMeasurement): SurfaceGeometry | undefined {
  if (object.projection === "selenographic") {
    const o = moonOrientation(date, site);
    return { project: (f) => projectSelenographic(f.latDeg, f.lonDeg, o), bodyRadiusKm: 1737.4, moon: o };
  }
  if (object.projection === "jovian") {
    const o = jupiterOrientation(date);
    const grsLonDeg = grsLongitude(date, grs);
    return {
      project: (f) => projectJovian(f.latDeg, f.longitude === "central-meridian" ? o.cm2Deg : f.longitude === "grs" ? grsLonDeg : f.lonDeg, o),
      bodyRadiusKm: 71_492,
      jupiter: { ...o, grsLonDeg, grsSource: grs ? "measured" : "model" },
    };
  }
  if (object.projection === "equatorial" && object.skyImage) {
    const { centerRaDeg, centerDecDeg, radiusArcsec } = object.skyImage;
    const D = Math.PI / 180;
    const a0 = centerRaDeg * D;
    const d0 = centerDecDeg * D;
    return {
      // Gnomonic (tangent-plane) offsets from the image centre, north up and east left as drawn.
      project: (f) => {
        const a = f.lonDeg * D;
        const d = f.latDeg * D;
        const cosc = Math.sin(d) * Math.sin(d0) + Math.cos(d) * Math.cos(d0) * Math.cos(a - a0);
        const xi = (Math.cos(d) * Math.sin(a - a0)) / cosc;
        const eta = (Math.sin(d) * Math.cos(d0) - Math.cos(d) * Math.sin(d0) * Math.cos(a - a0)) / cosc;
        const toUnits = 206_264.806 / radiusArcsec;
        return { x: -xi * toUnits, y: -eta * toUnits, z: 1, sunDot: 1 };
      },
      bodyRadiusKm: radiusArcsec,
      featureRadius: (f) => ((f.catalogue?.majorArcmin ?? 0) * 30) / radiusArcsec,
      pointFeatures: true,
    };
  }
  if (object.rings.length && object.targetId === "saturn") {
    const unitKm = SATURN_RADIUS_KM * SATURN_RING_RATIO;
    return {
      bodyRadiusKm: unitKm,
      rings: {
        tiltDeg: planetPosition("saturn", date).ringTiltDeg ?? 0,
        poleDeg: poleAngleDeg("saturn", date) ?? 0,
        unitKm,
        globeKm: SATURN_RADIUS_KM,
        globeRatio: 0.902,
      },
    };
  }
  return undefined;
}

/** Hours until a System II longitude next crosses Jupiter's central meridian. */
export function hoursToCentralMeridian(o: Pick<JupiterOrientation, "cm2Deg">, lonDeg: number): number {
  const ahead = (((lonDeg - o.cm2Deg) % 360) + 360) % 360;
  return (ahead / 870.27) * 24;
}
