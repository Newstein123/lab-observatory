import type { MoonOrientation } from "@/modules/sky/moon";
import type { GrsMeasurement, SurfaceGeometry } from "@/modules/explorer/projection";
import type { ExplorerObject, ExplorerSelection } from "@/modules/explorer/types";
import type { Discovery } from "@/modules/discoveries/models";

/** Everything the explorer panel needs to know about the current observation. */
export interface ExplorerContext {
  object: ExplorerObject;
  selection: ExplorerSelection;
  observedAt: Date;
  /** The observer's time zone, for times shown in the panel. */
  timeZone?: string;
  /** The Moon's orientation for this observation (Moon only). */
  orientation?: MoonOrientation;
  /** Where features and rings sit on the disc now. */
  geometry?: SurfaceGeometry;
  /** The Great Red Spot's longitude: a measured value, if the user gave one. */
  grs?: { measured?: GrsMeasurement; onChange: (m: GrsMeasurement | undefined) => void };
  /** Distance from the observer to the target body, km (Solar System only). */
  distanceKm?: number;
  /** What limits detail in this setup. */
  setup: {
    resolutionArcsec: number;
    magnification?: number;
    imageScaleArcsecPerPx?: number;
    /** Faintest star (point source) visible with this setup tonight, mag. */
    limitingMag?: number;
    /** e.g. "130 mm at 339×" */
    label: string;
  };
  /** The telescope's field on the body's disc: centre and radius in body radii, sky frame. */
  field?: { x: number; y: number; r: number };
  /** Ids of features currently inside the field. */
  inField: ReadonlySet<string>;
  pinned?: ExplorerSelection;
  /** Saving what is selected to the user's discoveries. */
  discovery?: { saved?: Discovery; canSave: boolean; busy: boolean; onToggle: () => void };
  onSelect: (s: ExplorerSelection) => void;
  onPin: (s: ExplorerSelection) => void;
  /** Slew the telescope so the feature is in the middle of the field. */
  onCentre: (featureId: string) => void;
  onClose: () => void;
}

export const selectionKey = (s?: ExplorerSelection) => (s ? (s.kind === "object" ? "object" : `${s.kind}:${s.id}`) : "");

/** Display name of what is selected (undefined for the object itself). */
export function selectionName(ctx: Pick<ExplorerContext, "object" | "selection">): string | undefined {
  const s = ctx.selection;
  if (s.kind === "feature") return ctx.object.features.find((f) => f.id === s.id)?.name;
  if (s.kind === "companion") return ctx.object.companions.find((c) => c.id === s.id)?.name;
  if (s.kind === "ring") return ctx.object.rings.find((r) => r.id === s.id)?.name;
  return undefined;
}
