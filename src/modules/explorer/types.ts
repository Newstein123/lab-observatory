/**
 * Data model of the Astronomical Object Explorer. Object metadata (names,
 * positions, properties, text) lives in these structures; visualisation
 * assets (maps, elevation, imagery) are described separately in asset
 * manifests and loaded on demand.
 */
import type { Provenance } from "@/modules/simulations/engine";

/** A citation: every property, text section and asset points at one or more. */
export interface Source {
  id: string;
  name: string;
  url: string;
  credit: string;
  license: string;
}

/** One value shown in the explorer, with where it came from. */
export interface Property {
  label: string;
  value: string;
  /** retrieved = measured/catalogued by the source; calculated = computed here; estimated = approximate or model-based. */
  kind: Provenance;
  sourceIds: string[];
  note?: string;
}

export interface LearnSection {
  heading: string;
  body: string;
  sourceIds: string[];
}

/** A named surface feature with selenographic (or planetographic) coordinates. */
export interface SurfaceFeature {
  id: string;
  name: string;
  /** IAU descriptor term, e.g. "Crater", "Mare", "Mons". */
  type: string;
  /** Planetocentric latitude and east-positive longitude (−180…180), degrees. */
  latDeg: number;
  lonDeg: number;
  diameterKm: number;
  nameOrigin: string;
  gazetteerUrl: string;
  /** 1 = always worth labelling … 3 = only when zoomed in. */
  priority: 1 | 2 | 3;
  /** An elevation crop exists for terrain views. */
  terrain: boolean;
  /**
   * How the longitude is found: fixed coordinates (default); always at the
   * central meridian (a latitude band); or a drifting longitude computed for
   * the date (the Great Red Spot).
   */
  longitude?: "fixed" | "central-meridian" | "grs";
  /** Deep-sky catalogue objects: latDeg/lonDeg are Dec/RA (J2000), with catalogue data. */
  catalogue?: import("./deep-sky/features").CatalogueInfo;
  summary: string;
  facts: string[];
  properties: Property[];
  learn: LearnSection[];
  /** Ids of features to explore next. */
  related: string[];
  sourceIds: string[];
}

/** A point-like companion found by its predicted position (e.g. a planet's moon). */
export interface Companion {
  id: string;
  name: string;
  classification: string;
  summary: string;
  facts: string[];
  properties: Property[];
  learn: LearnSection[];
  sourceIds: string[];
}

/** A ring or gap, by its distance from the planet's centre. */
export interface RingFeature {
  id: string;
  name: string;
  /** "Ring" or "Gap" (divisions and gaps are both gaps in the ring material). */
  type: "Ring" | "Gap";
  innerKm: number;
  outerKm: number;
  summary: string;
  facts: string[];
  properties: Property[];
  learn: LearnSection[];
  /** 1 = labelled at normal scales … 3 = only when large. */
  priority: 1 | 2 | 3;
  sourceIds: string[];
}

export type ExplorerTab = "info" | "model" | "map" | "learn" | "image";
export type VisualizationKind = "globe3d" | "terrain3d" | "surfaceMap" | "crossSection" | "planet3d" | "orbits" | "skyImage";

/** What can be picked out inside the eyepiece view for this target. */
export type Identifiable = "surface-features" | "satellites" | "none";

/** How surface coordinates map onto the disc. */
export type SurfaceProjection = "selenographic" | "jovian" | "equatorial";

export interface ExplorerObject {
  id: string;
  targetId: string;
  name: string;
  classification: string;
  summary: string;
  properties: Property[];
  facts: string[];
  learn: LearnSection[];
  sourceIds: string[];
  identifiable: Identifiable;
  /** Separate scientific visualisations available for this object. */
  visualizations: VisualizationKind[];
  features: SurfaceFeature[];
  companions: Companion[];
  /** Planetary rings (Saturn). */
  rings: RingFeature[];
  /** For objects with surface features. */
  projection?: SurfaceProjection;
  /** Deep sky: the survey image the view draws (its centre is the view's origin) and the target's angular radius. */
  skyImage?: { centerRaDeg: number; centerDecDeg: number; radiusArcsec: number };
}

/** What is open in the explorer: the target itself, a surface feature or a companion. */
export type ExplorerSelection =
  | { kind: "object" }
  | { kind: "feature"; id: string }
  | { kind: "companion"; id: string }
  | { kind: "ring"; id: string };
