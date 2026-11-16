import type { FilterKind, TargetExtent } from "./models";

type Category = NonNullable<TargetExtent["category"]>;

/**
 * Typical fraction of a target's visible light passed by each filter kind.
 * Line filters pass most of an emission nebula's light but little of the
 * continuum from stars, clusters, galaxies, planets and the Moon. Approximate values
 * for illustration of relative effect, not manufacturer curves.
 */
const TRANSMISSION: Record<FilterKind, Record<Category, number>> = {
  neutral_density: { moon: 0.13, planet: 0.13, nebula: 0.13, galaxy: 0.13, cluster: 0.13 },
  uhc: { moon: 0.25, planet: 0.25, nebula: 0.85, galaxy: 0.3, cluster: 0.3 },
  oiii: { moon: 0.08, planet: 0.08, nebula: 0.55, galaxy: 0.1, cluster: 0.1 },
  light_pollution: { moon: 0.75, planet: 0.75, nebula: 0.85, galaxy: 0.7, cluster: 0.7 },
  color_blue: { moon: 0.3, planet: 0.3, nebula: 0.4, galaxy: 0.3, cluster: 0.3 },
  color_orange: { moon: 0.45, planet: 0.45, nebula: 0.5, galaxy: 0.45, cluster: 0.45 },
  other: { moon: 1, planet: 1, nebula: 1, galaxy: 1, cluster: 1 },
};

/** Transmission for a filter kind and target class (galaxy-like continuum when unknown). */
export function filterTransmission(kind: FilterKind, category: Category | undefined): number {
  return TRANSMISSION[kind][category ?? "galaxy"];
}
