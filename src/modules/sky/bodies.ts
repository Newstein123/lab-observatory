/**
 * Where a catalogue target is in the sky at a time and place, and how it
 * looks then: one entry point over the Moon, planets and fixed deep-sky
 * objects. CALCULATED.
 */
import type { CuratedTarget } from "@/modules/targets/catalogue";
import { airmass, apparentAltitude, compass, parallacticAngle, precessFromJ2000, toHorizontal, type Equatorial, type Site } from "./coords";
import { moonPhase, moonPosition, topocentric } from "./moon";
import { isPlanet, planetPosition } from "./planets";
import { julianCenturies } from "./time";

export interface BodyPhase {
  /** Fraction of the disc lit, 0…1. */
  illuminated: number;
  /** Phase angle, degrees (0 = fully lit). */
  phaseAngleDeg: number;
  /** Position angle of the bright limb: from north through east, degrees (north up, east left = counter-clockwise). */
  brightLimbDeg: number;
  /** The same as seen standing up (zenith up): position angle minus the parallactic angle. */
  brightLimbZenithDeg: number;
}

export interface BodyState {
  eq: Equatorial;
  /** Geometric altitude (Moon: topocentric), degrees. */
  altDeg: number;
  /** Altitude including refraction. */
  apparentAltDeg: number;
  azDeg: number;
  direction: string;
  /** Air mass along the line of sight; undefined below the horizon. */
  airmass?: number;
  aboveHorizon: boolean;
  /** Date-dependent brightness and size (Solar System only). */
  magnitude?: number;
  majorArcsec?: number;
  minorArcsec?: number;
  phase?: BodyPhase;
  /** Saturn: ring tilt towards us, degrees. */
  ringTiltDeg?: number;
}

/** The Moon or a planet only: an equatorial position without the extra work (for fast sampling). */
export function equatorialOf(target: Pick<CuratedTarget, "id" | "coordinatesJ2000">, date: Date, site: Site): Equatorial | undefined {
  if (target.id === "moon") {
    const m = moonPosition(date);
    return topocentric(m, m.distanceKm, site, date);
  }
  if (isPlanet(target.id)) return planetPosition(target.id, date);
  if (target.coordinatesJ2000) return precessFromJ2000(target.coordinatesJ2000, julianCenturies(date));
  return undefined;
}

export function bodyState(target: Pick<CuratedTarget, "id" | "coordinatesJ2000">, date: Date, site: Site): BodyState | undefined {
  const eq = equatorialOf(target, date, site);
  if (!eq) return undefined;
  const hz = toHorizontal(eq, site, date);
  const app = apparentAltitude(hz.altDeg);
  const state: BodyState = {
    eq,
    altDeg: hz.altDeg,
    apparentAltDeg: app,
    azDeg: hz.azDeg,
    direction: compass(hz.azDeg),
    airmass: airmass(app),
    aboveHorizon: app > 0,
  };
  const q = parallacticAngle(eq, site, date);
  if (target.id === "moon") {
    const p = moonPhase(date);
    state.magnitude = p.magnitude;
    state.majorArcsec = state.minorArcsec = p.diameterArcsec;
    state.phase = { illuminated: p.illuminated, phaseAngleDeg: p.phaseAngleDeg, brightLimbDeg: p.brightLimbDeg, brightLimbZenithDeg: p.brightLimbDeg - q };
  } else if (isPlanet(target.id)) {
    const p = planetPosition(target.id, date);
    state.magnitude = p.magnitude;
    state.majorArcsec = p.majorArcsec;
    state.minorArcsec = p.minorArcsec;
    state.ringTiltDeg = p.ringTiltDeg;
    // Only the inner planets and Mars show a phase you can notice.
    if (target.id === "venus" || target.id === "mercury" || target.id === "mars") {
      state.phase = { illuminated: p.illuminated, phaseAngleDeg: p.phaseAngleDeg, brightLimbDeg: p.brightLimbDeg, brightLimbZenithDeg: p.brightLimbDeg - q };
    }
  }
  return state;
}
