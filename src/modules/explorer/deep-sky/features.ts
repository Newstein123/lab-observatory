import type { Property, SurfaceFeature } from "../types";
import { DEEP_SKY_CONTENT } from "./content";
import data from "./features.json";

export type DeepSkyKind = "star" | "cluster" | "nebula" | "region" | "galaxy";

export interface CatalogueInfo {
  kind: DeepSkyKind;
  simbadId: string;
  simbadUrl: string;
  otype: string;
  vMag?: number;
  majorArcmin?: number;
  parallaxMas?: number;
  parallaxErrMas?: number;
  spType?: string;
  visibility?: { title: string; body: string };
}

const LY_PER_PC = 3.26156;

/** Distance from a parallax, light-years: CALCULATED, only when the parallax is well measured. */
export function distanceFromParallax(plxMas?: number, errMas?: number): { ly: number; errLy?: number } | undefined {
  if (!plxMas || plxMas <= 0 || (errMas !== undefined && errMas / plxMas > 0.2)) return undefined;
  const ly = (1000 / plxMas) * LY_PER_PC;
  return { ly, errLy: errMas !== undefined ? ly * (errMas / plxMas) : undefined };
}

const KIND_LABEL: Record<DeepSkyKind, string> = { star: "Star", cluster: "Star cluster", nebula: "Nebula", region: "Nebula region", galaxy: "Galaxy" };

/** Named catalogue objects in a target's survey image, as explorer features (latDeg/lonDeg = Dec/RA). */
export function deepSkyFeatures(targetId: string): SurfaceFeature[] {
  return data.features
    .filter((f) => f.targetId === targetId)
    .map((f) => {
      const c = DEEP_SKY_CONTENT[f.id];
      const kind = f.kind as DeepSkyKind;
      const props: Property[] = [];
      if (f.vMag !== undefined && f.vMag !== null) props.push({ label: "Magnitude (V)", value: f.vMag.toFixed(1), kind: "retrieved", sourceIds: ["simbad"] });
      if (f.spType) props.push({ label: "Spectral type", value: f.spType, kind: "retrieved", sourceIds: ["simbad"] });
      const dist = distanceFromParallax(f.parallaxMas ?? undefined, f.parallaxErrMas ?? undefined);
      if (dist)
        props.push({
          label: "Distance",
          value: `≈ ${Math.round(dist.ly / 10) * 10} light-years`,
          kind: "calculated",
          sourceIds: ["simbad"],
          note: `From the Gaia/Hipparcos parallax of ${f.parallaxMas} mas${dist.errLy ? ` (± ${Math.round(dist.errLy)} ly)` : ""}.`,
        });
      if (f.majorArcmin) props.push({ label: "Apparent size", value: `${f.majorArcmin}′`, kind: "retrieved", sourceIds: ["simbad"] });
      return {
        id: f.id,
        name: f.name,
        type: KIND_LABEL[kind],
        latDeg: f.decDeg,
        lonDeg: f.raDeg,
        diameterKm: 0,
        nameOrigin: "",
        gazetteerUrl: "",
        priority: f.priority as 1 | 2 | 3,
        terrain: false,
        summary: c?.summary ?? `${KIND_LABEL[kind]} (${f.simbadId}).`,
        facts: c?.facts ?? [],
        properties: props,
        learn: [],
        related: c?.related ?? [],
        sourceIds: c?.sourceIds ?? ["simbad"],
        catalogue: {
          kind,
          simbadId: f.simbadId,
          simbadUrl: f.simbadUrl,
          otype: f.otype,
          vMag: f.vMag ?? undefined,
          majorArcmin: f.majorArcmin ?? undefined,
          parallaxMas: f.parallaxMas ?? undefined,
          parallaxErrMas: f.parallaxErrMas ?? undefined,
          spType: f.spType ?? undefined,
          visibility: c?.visibility,
        },
      };
    });
}

export const DEEP_SKY_RETRIEVED_AT = data.retrievedAt;
