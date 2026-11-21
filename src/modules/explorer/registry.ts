/**
 * Which explorer tabs an object (or one of its parts) offers. Tabs only
 * appear when there is something real to show: a nebula never gets a
 * planetary surface map; a moon seen as a point of light gets an orbit view,
 * not a surface.
 */
import type { ExplorerObject, ExplorerSelection, ExplorerTab } from "./types";

export const TAB_LABELS: Record<ExplorerTab, string> = {
  info: "Object Info",
  model: "3D Model",
  map: "Surface Map",
  image: "Image",
  learn: "Learn",
};

export function tabsFor(object: ExplorerObject, selection: ExplorerSelection): ExplorerTab[] {
  const tabs: ExplorerTab[] = ["info"];
  const v = new Set(object.visualizations);
  const hasLearn = (x?: { learn: unknown[]; facts: unknown[]; related?: unknown[] }) => Boolean(x && (x.learn.length || x.facts.length || x.related?.length));

  if (selection.kind === "companion") {
    const c = object.companions.find((x) => x.id === selection.id);
    if (v.has("orbits")) tabs.push("model");
    if (c?.learn.length) tabs.push("learn");
    return tabs;
  }
  if (selection.kind === "ring") {
    const r = object.rings.find((x) => x.id === selection.id);
    if (v.has("planet3d")) tabs.push("model");
    if (hasLearn(r)) tabs.push("learn");
    return tabs;
  }
  if (selection.kind === "feature") {
    const f = object.features.find((x) => x.id === selection.id);
    if (v.has("globe3d") || v.has("planet3d") || (f?.terrain && v.has("terrain3d"))) tabs.push("model");
    if (v.has("surfaceMap")) tabs.push("map");
    if (v.has("skyImage")) tabs.push("image");
    if (hasLearn(f)) tabs.push("learn");
    return tabs;
  }
  if (v.has("globe3d") || v.has("planet3d") || v.has("orbits")) tabs.push("model");
  if (v.has("surfaceMap")) tabs.push("map");
  if (v.has("skyImage")) tabs.push("image");
  if (object.learn.length || object.features.length || object.companions.length) tabs.push("learn");
  return tabs;
}
