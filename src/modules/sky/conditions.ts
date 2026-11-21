/**
 * Puts it together: for a place, a time and the weather, where the target and
 * the Moon are, how bright the sky is towards the target, and the numbers the
 * simulation engine takes. Pure.
 */
import type { ObservingConditions } from "@/modules/simulations/engine";
import type { CuratedTarget } from "@/modules/targets/catalogue";
import type { ReachSky } from "@/modules/targets/reach";
import { bodyState, type BodyState } from "./bodies";
import { airmass, separation, toHorizontal } from "./coords";
import { moonPhase, type MoonPhase } from "./moon";
import type { ObservingSite } from "./sites";
import {
  aodFromHumidity,
  bortleSqm,
  cloudTransmission,
  extinctionCoefficient,
  HAZE,
  NATURAL_SKY,
  skyBrightness,
  type HazeLevel,
  type SkyBrightness,
} from "./sky-brightness";
import { sunPosition, twilightOf, type Twilight } from "./sun";

export interface Weather {
  /** Cloud cover, 0…1. */
  cloud: number;
  /** Relative humidity, %. */
  humidity?: number;
  /** Measured aerosol optical depth at 550 nm (from a forecast); wins over `haze`. */
  aod?: number;
  /** A chosen haze level (manual). */
  haze?: HazeLevel;
  /** Seeing at the zenith, arcsec FWHM. */
  seeingArcsec: number;
}

export interface SkySetting {
  site: ObservingSite;
  at: Date;
  /** Light pollution: Bortle 1…9 (an SQM reading wins if given). */
  bortle: number;
  sqm?: number;
  weather: Weather;
}

export interface SkyEvaluation {
  target?: BodyState;
  sunAltDeg: number;
  twilight: Twilight;
  moon: BodyState;
  moonPhase: MoonPhase;
  /** Extinction coefficient, mag per air mass. */
  k: number;
  sky: SkyBrightness;
  /** Inputs for the simulation engine. */
  conditions: ObservingConditions;
  /** Inputs for `assessReach`. */
  reach: ReachSky;
}

/** Aerosol optical depth in use: measured, else the chosen haze, else a guess from humidity. */
export function aodOf(w: Weather): number {
  if (w.aod !== undefined) return w.aod;
  if (w.haze) return HAZE.find((h) => h.id === w.haze)!.aod;
  if (w.humidity !== undefined) return aodFromHumidity(w.humidity);
  return 0.1;
}

export function zenithSqm(s: Pick<SkySetting, "bortle" | "sqm">): number {
  return s.sqm ?? bortleSqm(s.bortle);
}

export function evaluateSky(setting: SkySetting, target: Pick<CuratedTarget, "id" | "coordinatesJ2000">): SkyEvaluation {
  const { site, at, weather } = setting;
  const sun = toHorizontal(sunPosition(at), site, at);
  const moon = bodyState({ id: "moon" }, at, site)!;
  const phase = moonPhase(at);
  const body = target.id === "moon" ? moon : bodyState(target, at, site);
  const k = extinctionCoefficient({ aerosolOpticalDepth: aodOf(weather), elevationM: site.elevationM });
  const altDeg = body?.apparentAltDeg ?? 90;
  const sky = skyBrightness({
    zenithSqm: zenithSqm(setting),
    sunAltDeg: sun.altDeg,
    moonAltDeg: moon.apparentAltDeg,
    moonPhaseAngleDeg: phase.phaseAngleDeg,
    // Looking at the Moon itself: its own glare isn't "sky".
    moonSeparationDeg: target.id === "moon" || !body ? 180 : separation(body.eq, moon.eq),
    targetAltDeg: altDeg,
    k,
    cloud: weather.cloud,
  });
  const x = body?.airmass;
  const conditions: ObservingConditions = {
    seeingArcsec: weather.seeingArcsec,
    skyBrightnessMagArcsec2: round(sky.mag, 2),
    cloudTransmission: round(cloudTransmission(weather.cloud), 3),
    ...(body ? { targetAltitudeDeg: round(body.apparentAltDeg, 2) } : {}),
    ...(x !== undefined ? { airmass: round(x, 3), extinctionMag: round(k * x, 3) } : {}),
  };
  return {
    target: body,
    sunAltDeg: sun.altDeg,
    twilight: twilightOf(sun.altDeg),
    moon,
    moonPhase: phase,
    k,
    sky,
    conditions,
    reach: {
      skyMag: sky.mag,
      extinctionMag: conditions.extinctionMag,
      cloudTransmission: conditions.cloudTransmission,
      altitudeDeg: body?.apparentAltDeg,
    },
  };
}

/** Excellent seeing for the ideal case, arcsec. */
export const IDEAL_SEEING = 0.8;

/**
 * The best case for the same target from the same latitude: a pristine dark
 * sky, no Moon or twilight, no cloud or haze, excellent seeing, and the target
 * at the highest point it ever reaches there (overhead if it never rises).
 */
export function idealConditions(setting: SkySetting, target: Pick<CuratedTarget, "id" | "coordinatesJ2000">): { conditions: ObservingConditions; reach: ReachSky; altitudeDeg: number } {
  const body = bodyState(target, setting.at, setting.site);
  const culmination = body ? 90 - Math.abs(setting.site.latDeg - body.eq.decDeg) : 90;
  const altitudeDeg = culmination > 0 ? culmination : 90;
  const x = airmass(altitudeDeg) ?? 1;
  const k = extinctionCoefficient({ aerosolOpticalDepth: 0.03, elevationM: setting.site.elevationM });
  const conditions: ObservingConditions = {
    seeingArcsec: IDEAL_SEEING,
    skyBrightnessMagArcsec2: NATURAL_SKY,
    cloudTransmission: 1,
    targetAltitudeDeg: round(altitudeDeg, 2),
    airmass: round(x, 3),
    extinctionMag: round(k * x, 3),
  };
  return { conditions, reach: { skyMag: NATURAL_SKY, extinctionMag: conditions.extinctionMag, cloudTransmission: 1, altitudeDeg }, altitudeDeg };
}

/**
 * The target as it is on that date: the Moon's and planets' size and
 * brightness change with distance and phase. Deep-sky targets are unchanged.
 */
export function datedTarget(target: CuratedTarget, state: BodyState | undefined): CuratedTarget {
  if (!state || state.magnitude === undefined || state.majorArcsec === undefined || state.minorArcsec === undefined) return target;
  return {
    ...target,
    magnitude: round(state.magnitude, 2),
    angularSize: {
      ...target.angularSize,
      majorAxisArcsec: round(state.majorArcsec, 2),
      minorAxisArcsec: round(state.minorArcsec, 2),
      note: target.id === "saturn" ? "Calculated for the chosen date: the rings' width, and their apparent height at today's tilt." : "Calculated for the chosen date from its distance.",
    },
  };
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
