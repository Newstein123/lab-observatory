import type { SurfaceFeature } from "../types";
import { LUNAR_CONTENT, TYPE_LABELS } from "./content";
import data from "./features.json";

/** Gazetteer positions and sizes merged with the curated science. */
export const LUNAR_FEATURES: readonly SurfaceFeature[] = data.features.map((f) => {
  const c = LUNAR_CONTENT[f.id];
  const type = lunarTypeLabel(f.type, f.name);
  return {
    id: f.id,
    name: f.name,
    type: f.type,
    latDeg: f.latDeg,
    lonDeg: f.lonDeg,
    diameterKm: f.diameterKm,
    nameOrigin: f.nameOrigin,
    gazetteerUrl: f.gazetteerUrl,
    priority: f.priority as 1 | 2 | 3,
    terrain: f.terrain,
    summary: c?.summary ?? type.summary,
    facts: c?.facts ?? [],
    properties: c?.properties ?? [],
    learn: c?.learn ?? [],
    related: c?.related ?? [],
    sourceIds: c?.sourceIds ?? ["gazetteer"],
  };
});

export const LUNAR_FEATURES_RETRIEVED_AT = data.retrievedAt;

export function getLunarFeature(id: string): SurfaceFeature | undefined {
  return LUNAR_FEATURES.find((f) => f.id === id);
}

/** Display label for an IAU descriptor term ("Mons" covers single peaks and ranges). */
export function lunarTypeLabel(type: string, name = ""): { label: string; plural: string; summary: string } {
  if (type === "Mons" && name.startsWith("Montes")) return TYPE_LABELS.Montes;
  return TYPE_LABELS[type] ?? { label: type, plural: type, summary: `A lunar ${type.toLowerCase()}.` };
}
