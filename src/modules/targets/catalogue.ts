import type { TargetExtent } from "@/modules/simulations/engine";

/**
 * Curated MVP target catalogue (spec §6.1).
 *
 * VERIFICATION STATUS: values below are commonly cited reference values,
 * entered by hand. They must be replaced or confirmed by the SIMBAD (deep-sky)
 * and JPL Horizons (solar-system) provider adapters before being presented as
 * "retrieved" data. Until then the UI must label them as estimated.
 */

export type TargetCategory = "moon" | "planet" | "nebula" | "galaxy" | "cluster";

export const TARGET_GROUPS: { category: TargetCategory | "solar"; label: string; categories: TargetCategory[] }[] = [
  { category: "solar", label: "Solar System", categories: ["moon", "planet"] },
  { category: "galaxy", label: "Galaxies", categories: ["galaxy"] },
  { category: "nebula", label: "Nebulae", categories: ["nebula"] },
  { category: "cluster", label: "Star clusters", categories: ["cluster"] },
];

export interface CuratedTarget {
  id: string;
  name: string;
  designation?: string;
  category: TargetCategory;
  /** Descriptive class, e.g. "Spiral galaxy", "Globular cluster". */
  subtype: string;
  /** Integrated visual magnitude (representative for planets). */
  magnitude: number;
  /** J2000 equatorial coordinates, degrees. Absent for moving solar-system bodies. */
  coordinatesJ2000?: { raDeg: number; decDeg: number };
  angularSize: {
    majorAxisArcsec: number;
    minorAxisArcsec: number;
    /** For bodies whose apparent size changes over time. */
    rangeArcsec?: { min: number; max: number };
    /** Position angle of the major axis, degrees east of north. */
    positionAngleDeg?: number;
    note: string;
  };
  /** Exposure that gives a reasonable camera preview; a UI default only. */
  suggestedExposureS: number;
  provenance: {
    source: string;
    verification: "pending" | "verified";
    /** Adapter expected to supply authoritative values. */
    authoritativeProvider: "simbad" | "jpl_horizons";
  };
}

const HORIZONS = (what: string) => ({
  source: `${what}; pending JPL Horizons`,
  verification: "pending" as const,
  authoritativeProvider: "jpl_horizons" as const,
});
const SIMBAD = {
  source: "Commonly cited catalogue values; pending SIMBAD",
  verification: "pending" as const,
  authoritativeProvider: "simbad" as const,
};

interface DsoSpec {
  id: string;
  name: string;
  designation: string;
  category: "nebula" | "galaxy" | "cluster";
  subtype: string;
  magnitude: number;
  raDeg: number;
  decDeg: number;
  /** Arcminutes. */
  major: number;
  minor: number;
  pa?: number;
  exposureS: number;
  note?: string;
}

const arcmin = (v: number) => Math.round(v * 60 * 10) / 10;

function dso(d: DsoSpec): CuratedTarget {
  return {
    id: d.id,
    name: d.name,
    designation: d.designation,
    category: d.category,
    subtype: d.subtype,
    magnitude: d.magnitude,
    coordinatesJ2000: { raDeg: d.raDeg, decDeg: d.decDeg },
    angularSize: {
      majorAxisArcsec: arcmin(d.major),
      minorAxisArcsec: arcmin(d.minor),
      ...(d.pa !== undefined ? { positionAngleDeg: d.pa } : {}),
      note: d.note ?? `Commonly cited visual extent ${d.major}′ × ${d.minor}′; apparent size depends on exposure and sky conditions.`,
    },
    suggestedExposureS: d.exposureS,
    provenance: SIMBAD,
  };
}

export const TARGETS: readonly CuratedTarget[] = [
  // ---- Solar System -------------------------------------------------------
  {
    id: "moon",
    name: "Moon",
    category: "moon",
    subtype: "Natural satellite",
    magnitude: -12.7,
    angularSize: {
      majorAxisArcsec: 1866,
      minorAxisArcsec: 1866,
      rangeArcsec: { min: 1758, max: 2046 },
      note: "Mean apparent diameter (~31.1′); varies about 29.3′–34.1′ with distance.",
    },
    suggestedExposureS: 0.005,
    provenance: HORIZONS("Commonly cited mean value"),
  },
  {
    id: "venus",
    name: "Venus",
    category: "planet",
    subtype: "Planet",
    magnitude: -4.2,
    angularSize: {
      majorAxisArcsec: 25,
      minorAxisArcsec: 25,
      rangeArcsec: { min: 9.7, max: 66 },
      note: "Representative diameter near greatest elongation, when Venus shows a half phase. It is a thin crescent when largest and nearly full when smallest.",
    },
    suggestedExposureS: 0.001,
    provenance: HORIZONS("Commonly cited range"),
  },
  {
    id: "mars",
    name: "Mars",
    category: "planet",
    subtype: "Planet",
    magnitude: -1.0,
    angularSize: {
      majorAxisArcsec: 14,
      minorAxisArcsec: 14,
      rangeArcsec: { min: 3.5, max: 25.1 },
      note: "Representative diameter at a typical opposition; Mars shrinks to a few arcseconds away from opposition.",
    },
    suggestedExposureS: 0.005,
    provenance: HORIZONS("Commonly cited range"),
  },
  {
    id: "jupiter",
    name: "Jupiter",
    category: "planet",
    subtype: "Planet",
    magnitude: -2.5,
    angularSize: {
      majorAxisArcsec: 44,
      minorAxisArcsec: 41.1,
      rangeArcsec: { min: 29.8, max: 50.1 },
      note: "Representative equatorial diameter near opposition; polar axis ~6.5% smaller.",
    },
    suggestedExposureS: 0.01,
    provenance: HORIZONS("Commonly cited range"),
  },
  {
    id: "saturn",
    name: "Saturn",
    category: "planet",
    subtype: "Planet",
    magnitude: 0.6,
    angularSize: {
      majorAxisArcsec: 41,
      minorAxisArcsec: 16.5,
      rangeArcsec: { min: 33, max: 46 },
      note: "Representative ring-system width; minor axis uses the globe's polar diameter because ring tilt varies with date.",
    },
    suggestedExposureS: 0.02,
    provenance: HORIZONS("Commonly cited range"),
  },
  {
    id: "uranus",
    name: "Uranus",
    category: "planet",
    subtype: "Planet",
    magnitude: 5.7,
    angularSize: {
      majorAxisArcsec: 3.7,
      minorAxisArcsec: 3.7,
      rangeArcsec: { min: 3.3, max: 4.1 },
      note: "A small pale blue-green disc; no surface detail is visible in amateur telescopes.",
    },
    suggestedExposureS: 0.1,
    provenance: HORIZONS("Commonly cited range"),
  },
  {
    id: "neptune",
    name: "Neptune",
    category: "planet",
    subtype: "Planet",
    magnitude: 7.8,
    angularSize: {
      majorAxisArcsec: 2.3,
      minorAxisArcsec: 2.3,
      rangeArcsec: { min: 2.2, max: 2.4 },
      note: "A tiny blue disc that needs high magnification to tell from a star.",
    },
    suggestedExposureS: 0.3,
    provenance: HORIZONS("Commonly cited range"),
  },

  // ---- Galaxies -----------------------------------------------------------
  {
    ...dso({ id: "m31", name: "Andromeda Galaxy", designation: "M31", category: "galaxy", subtype: "Spiral galaxy", magnitude: 3.4, raDeg: 10.6847, decDeg: 41.2687, major: 190, minor: 60, pa: 35, exposureS: 120 }),
    angularSize: {
      majorAxisArcsec: 190 * 60,
      minorAxisArcsec: 60 * 60,
      positionAngleDeg: 35,
      note: "Commonly cited visual extent ~190′ × 60′; visually, usually only the bright core is seen.",
    },
  },
  dso({ id: "m33", name: "Triangulum Galaxy", designation: "M33", category: "galaxy", subtype: "Spiral galaxy", magnitude: 5.7, raDeg: 23.4621, decDeg: 30.6602, major: 70, minor: 40, pa: 23, exposureS: 180, note: "Large and low in surface brightness: easy in binoculars under dark skies, hard to see in light-polluted ones." }),
  dso({ id: "m51", name: "Whirlpool Galaxy", designation: "M51", category: "galaxy", subtype: "Interacting spiral galaxy", magnitude: 8.4, raDeg: 202.4696, decDeg: 47.1952, major: 11.2, minor: 6.9, pa: 163, exposureS: 120 }),
  dso({ id: "m81", name: "Bode's Galaxy", designation: "M81", category: "galaxy", subtype: "Spiral galaxy", magnitude: 6.9, raDeg: 148.8882, decDeg: 69.0653, major: 26.9, minor: 14.1, pa: 157, exposureS: 120 }),
  dso({ id: "m82", name: "Cigar Galaxy", designation: "M82", category: "galaxy", subtype: "Starburst galaxy", magnitude: 8.4, raDeg: 148.9697, decDeg: 69.6797, major: 11.2, minor: 4.3, pa: 65, exposureS: 120 }),
  dso({ id: "m101", name: "Pinwheel Galaxy", designation: "M101", category: "galaxy", subtype: "Face-on spiral galaxy", magnitude: 7.9, raDeg: 210.8025, decDeg: 54.3488, major: 28.8, minor: 26.9, exposureS: 180, note: "Large, face-on and faint per unit area; dark skies matter more than aperture." }),
  dso({ id: "m104", name: "Sombrero Galaxy", designation: "M104", category: "galaxy", subtype: "Edge-on spiral galaxy", magnitude: 8.0, raDeg: 189.9977, decDeg: -11.6231, major: 8.7, minor: 3.5, pa: 90, exposureS: 90 }),
  dso({ id: "m64", name: "Black Eye Galaxy", designation: "M64", category: "galaxy", subtype: "Spiral galaxy", magnitude: 8.5, raDeg: 194.1821, decDeg: 21.6827, major: 10.7, minor: 5.1, pa: 115, exposureS: 90 }),
  dso({ id: "ngc253", name: "Sculptor Galaxy", designation: "NGC 253", category: "galaxy", subtype: "Starburst spiral galaxy", magnitude: 7.1, raDeg: 11.888, decDeg: -25.2883, major: 27.5, minor: 6.8, pa: 52, exposureS: 120 }),

  // ---- Nebulae ------------------------------------------------------------
  dso({ id: "m42", name: "Orion Nebula", designation: "M42", category: "nebula", subtype: "Emission nebula", magnitude: 4.0, raDeg: 83.8221, decDeg: -5.3911, major: 85, minor: 60, exposureS: 30, note: "Commonly cited visual extent 85′ × 60′; apparent size depends strongly on exposure and sky conditions." }),
  dso({ id: "m8", name: "Lagoon Nebula", designation: "M8", category: "nebula", subtype: "Emission nebula", magnitude: 6.0, raDeg: 270.904, decDeg: -24.387, major: 90, minor: 40, exposureS: 60 }),
  dso({ id: "m20", name: "Trifid Nebula", designation: "M20", category: "nebula", subtype: "Emission and reflection nebula", magnitude: 6.3, raDeg: 270.596, decDeg: -23.03, major: 28, minor: 28, exposureS: 90 }),
  dso({ id: "m17", name: "Omega Nebula", designation: "M17", category: "nebula", subtype: "Emission nebula", magnitude: 6.0, raDeg: 275.108, decDeg: -16.177, major: 20, minor: 15, exposureS: 60 }),
  dso({ id: "m1", name: "Crab Nebula", designation: "M1", category: "nebula", subtype: "Supernova remnant", magnitude: 8.4, raDeg: 83.6331, decDeg: 22.0145, major: 7, minor: 5, exposureS: 120 }),
  dso({ id: "m57", name: "Ring Nebula", designation: "M57", category: "nebula", subtype: "Planetary nebula", magnitude: 8.8, raDeg: 283.3962, decDeg: 33.0292, major: 1.4, minor: 1.0, exposureS: 30, note: "Small but bright per unit area; the ring shows well at medium to high magnification." }),
  dso({ id: "m27", name: "Dumbbell Nebula", designation: "M27", category: "nebula", subtype: "Planetary nebula", magnitude: 7.5, raDeg: 299.9016, decDeg: 22.7212, major: 8, minor: 5.7, exposureS: 60 }),
  dso({ id: "ngc7293", name: "Helix Nebula", designation: "NGC 7293", category: "nebula", subtype: "Planetary nebula", magnitude: 7.6, raDeg: 337.4108, decDeg: -20.8372, major: 16, minor: 12, exposureS: 180, note: "Large and faint per unit area; an OIII or UHC filter helps visually." }),

  // ---- Star clusters ------------------------------------------------------
  dso({ id: "m45", name: "Pleiades", designation: "M45", category: "cluster", subtype: "Open cluster", magnitude: 1.6, raDeg: 56.85, decDeg: 24.1167, major: 110, minor: 110, exposureS: 30, note: "Best at low power: the cluster spans almost 2°, wider than most telescope fields." }),
  dso({ id: "m44", name: "Beehive Cluster", designation: "M44", category: "cluster", subtype: "Open cluster", magnitude: 3.7, raDeg: 130.1, decDeg: 19.6667, major: 95, minor: 95, exposureS: 10 }),
  dso({ id: "double-cluster", name: "Double Cluster", designation: "NGC 869/884", category: "cluster", subtype: "Pair of open clusters", magnitude: 3.7, raDeg: 35.16, decDeg: 57.13, major: 60, minor: 30, pa: 90, exposureS: 10 }),
  dso({ id: "m11", name: "Wild Duck Cluster", designation: "M11", category: "cluster", subtype: "Open cluster", magnitude: 5.8, raDeg: 282.7708, decDeg: -6.27, major: 14, minor: 14, exposureS: 20 }),
  dso({ id: "m13", name: "Hercules Cluster", designation: "M13", category: "cluster", subtype: "Globular cluster", magnitude: 5.8, raDeg: 250.4235, decDeg: 36.4613, major: 20, minor: 20, exposureS: 30 }),
  dso({ id: "m22", name: "Sagittarius Cluster", designation: "M22", category: "cluster", subtype: "Globular cluster", magnitude: 5.1, raDeg: 279.0998, decDeg: -23.9048, major: 32, minor: 32, exposureS: 30 }),
] as const;

/** Shown first on the landing page and as defaults. */
export const FEATURED_TARGET_IDS = ["moon", "jupiter", "saturn", "m42", "m31"] as const;

/**
 * Mean surface brightness, mag/arcsec²: the integrated magnitude spread over
 * the catalogued elliptical extent. A rough guide to how faint an extended
 * object looks; real objects are brighter in the core and fainter outside.
 */
export function surfaceBrightness(t: CuratedTarget): number | undefined {
  // Snapshots saved before magnitudes were catalogued have none.
  if (typeof t.magnitude !== "number") return undefined;
  const area = (Math.PI / 4) * t.angularSize.majorAxisArcsec * t.angularSize.minorAxisArcsec;
  return t.magnitude + 2.5 * Math.log10(area);
}

export function getTarget(id: string): CuratedTarget | undefined {
  return TARGETS.find((t) => t.id === id);
}

/** Map a curated target to the engine's input shape. */
export function toTargetExtent(target: CuratedTarget): TargetExtent {
  return {
    id: target.id,
    majorAxisArcsec: target.angularSize.majorAxisArcsec,
    minorAxisArcsec: target.angularSize.minorAxisArcsec,
    category: target.category,
    ...(target.coordinatesJ2000 ? { declinationDeg: target.coordinatesJ2000.decDeg } : {}),
  };
}
