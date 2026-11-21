/**
 * Rebuild the drawn sky and phase of a saved session from what it stored:
 * the engine conditions (sky brightness, dimming, altitude) and the place and
 * time (for the Moon's or a planet's phase).
 */
import type { ViewAtmosphere, ViewPhase } from "@/modules/simulations/renderers/atmosphere";
import { bodyState } from "@/modules/sky/bodies";
import type { SimulationSession } from "./models";

export function sessionAtmosphere(session: SimulationSession): ViewAtmosphere | undefined {
  const c = session.conditions;
  if (c.skyBrightnessMagArcsec2 === undefined) return undefined;
  return {
    skyMag: c.skyBrightnessMagArcsec2,
    source: session.view.skySource ?? "natural",
    extinctionMag: c.extinctionMag ?? 0,
    cloud: session.view.cloud ?? 0,
    altitudeDeg: c.targetAltitudeDeg ?? 90,
  };
}

export function sessionPhase(session: SimulationSession): ViewPhase | undefined {
  const { site, observedAt } = session.view;
  if (!site || !observedAt) return undefined;
  const p = bodyState(session.targetSnapshot, new Date(observedAt), site)?.phase;
  return p && { illuminated: p.illuminated, brightLimbDeg: p.brightLimbDeg, earthshine: session.targetSnapshot.id === "moon" };
}
