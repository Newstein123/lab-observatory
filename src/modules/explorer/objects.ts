/**
 * Explorer metadata per target. Adding an object = one entry here (plus its
 * features or companions and, if it has them, visualisation assets); the
 * panel, tabs and identification adapt from this description.
 */
import { formatAngleArcsec } from "@/lib/format";
import type { CuratedTarget } from "@/modules/targets/catalogue";
import { LUNAR_FEATURES } from "./lunar/features";
import { getReferenceImage } from "@/modules/targets/reference-images";
import { deepSkyFeatures } from "./deep-sky/features";
import { JUPITER, SATURN } from "./planets";
import type { ExplorerObject, Property } from "./types";

const p = (label: string, value: string, kind: Property["kind"], sourceIds: string[], note?: string): Property => ({
  label,
  value,
  kind,
  sourceIds,
  ...(note ? { note } : {}),
});

const MOON: Omit<ExplorerObject, "id" | "targetId"> = {
  name: "The Moon",
  classification: "Natural satellite",
  summary: "Earth's only natural satellite, with a surface shaped by impacts and ancient volcanic floods.",
  properties: [
    p("Mean radius", "1,737.4 km", "retrieved", ["nasaMoonFacts"]),
    p("Mass", "7.346 × 10²² kg", "retrieved", ["nasaMoonFacts"]),
    p("Mean distance", "384,400 km", "retrieved", ["nasaMoonFacts"]),
    p("Surface gravity", "1.62 m/s²", "retrieved", ["nasaMoonFacts"]),
    p("Rotation", "27.32 days (synchronous)", "retrieved", ["nasaMoonFacts"]),
  ],
  facts: [
    "It always keeps nearly the same face towards Earth, because it spins once per orbit.",
    "Libration lets us see about 59% of its surface over time.",
    "The dark maria are lava plains and the bright highlands are older, cratered crust.",
  ],
  learn: [
    {
      heading: "Formation",
      body: "The leading explanation is that the Moon formed from debris thrown out when a Mars-sized body hit the young Earth, about 4.5 billion years ago.",
      sourceIds: ["nasaMoon"],
    },
    {
      heading: "Highlands and maria",
      body: "The bright highlands are the Moon's original crust, battered by impacts. The dark maria are basalt lavas that later flooded the largest impact basins, mostly between about 3 and 3.9 billion years ago.",
      sourceIds: ["wilhelms1987", "nasaMoon"],
    },
    {
      heading: "Libration",
      body: "The Moon's orbit is elliptical and tilted, so from Earth we see it rock slightly from side to side and up and down. The explorer calculates this for your exact time and place, so feature positions match the real view.",
      sourceIds: ["meeus"],
    },
  ],
  sourceIds: ["nasaMoonFacts", "nasaMoon", "gazetteer"],
  identifiable: "surface-features",
  visualizations: ["globe3d", "surfaceMap", "terrain3d", "crossSection"],
  features: [...LUNAR_FEATURES],
  companions: [],
  rings: [],
  projection: "selenographic",
};

const CURATED: Record<string, Omit<ExplorerObject, "id" | "targetId">> = { moon: MOON, jupiter: JUPITER, saturn: SATURN };

/** The explorer description of a target: curated where available, otherwise from the catalogue. */
export function explorerObjectFor(target: CuratedTarget): ExplorerObject {
  const curated = CURATED[target.id];
  if (curated) return { id: target.id, targetId: target.id, ...curated };
  const properties: Property[] = [
    ...(target.designation ? [p("Designation", target.designation, "retrieved", ["catalogue"])] : []),
    p("Magnitude", target.magnitude.toFixed(1), "retrieved", ["catalogue"]),
    p(
      "Apparent size",
      target.angularSize.majorAxisArcsec === target.angularSize.minorAxisArcsec
        ? formatAngleArcsec(target.angularSize.majorAxisArcsec)
        : `${formatAngleArcsec(target.angularSize.majorAxisArcsec)} × ${formatAngleArcsec(target.angularSize.minorAxisArcsec)}`,
      "retrieved",
      ["catalogue"],
      target.angularSize.note,
    ),
  ];
  // Deep sky: named catalogue objects placed on the survey image the view draws.
  const image = getReferenceImage(target.id);
  const field = image?.kind === "field" ? image : undefined;
  const features = field ? deepSkyFeatures(target.id) : [];
  return {
    id: target.id,
    targetId: target.id,
    name: target.name,
    classification: target.subtype,
    summary: target.angularSize.note,
    properties,
    facts: [],
    learn: [],
    sourceIds: ["catalogue", ...(field ? ["skyview"] : [])],
    identifiable: features.length ? "surface-features" : "none",
    visualizations: field ? ["skyImage"] : [],
    features,
    companions: [],
    rings: [],
    ...(field
      ? {
          projection: "equatorial" as const,
          skyImage: { centerRaDeg: field.center.raDeg, centerDecDeg: field.center.decDeg, radiusArcsec: target.angularSize.majorAxisArcsec / 2 },
        }
      : {}),
  };
}
