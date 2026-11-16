import type { ConfigurationSpec } from "@/modules/configurations/models";
import { camera as cam, optics, type SimulationMode } from "@/modules/simulations/engine";
import { surfaceBrightness, type CuratedTarget } from "./catalogue";

/**
 * Whether a target is worth observing with a setup (ESTIMATED).
 *
 *   eyepiece: compares the target's magnitude with the aperture's limiting
 *             magnitude, and the surface brightness of nebulae and galaxies
 *             with what the dark-adapted eye can detect;
 *   camera:   checks how many pixels the target spans (long exposures reach
 *             far fainter than the eye, so faintness is not the limit).
 *
 * Assumes a dark, rural sky. Light pollution makes faint targets harder.
 */

export type Reach = "good" | "challenging" | "out_of_reach";

export interface ReachAssessment {
  reach: Reach;
  reasons: string[];
}

/** Surface brightness (mag/arcsec²) beyond which an extended object is hard / impractical by eye. */
export const SB_CHALLENGING = 22.5;
export const SB_OUT_OF_REACH = 24.5;
/** Pixels across the target below which a camera shows nothing useful / little detail. */
export const PX_OUT_OF_REACH = 6;
export const PX_CHALLENGING = 25;
/** Target larger than this multiple of the field: only part of it fits. */
const OVERSIZE = 1.5;

const RANK: Record<Reach, number> = { good: 0, challenging: 1, out_of_reach: 2 };
const valid = (...xs: (number | undefined)[]) => xs.every((x) => typeof x === "number" && Number.isFinite(x) && x > 0);
const fmt = (v: number, d = 1) => v.toFixed(d);

export function assessReach(target: CuratedTarget, spec: ConfigurationSpec, mode: SimulationMode): ReachAssessment {
  const found: { reach: Reach; reason: string }[] = [];
  const add = (reach: Reach, reason: string) => found.push({ reach, reason });
  const D = spec.telescope.apertureMm;
  const efl = spec.telescope.focalLengthMm * (spec.barlow?.factor ?? 1);
  const major = target.angularSize.majorAxisArcsec;

  if (!valid(D, efl)) return { reach: "good", reasons: [] };

  if (mode === "eyepiece") {
    const lim = optics.limitingMagnitude(D);
    const m = target.magnitude;
    if (typeof m === "number") {
      if (m > lim - 1) add("out_of_reach", `Magnitude ${fmt(m)} is beyond the estimated reach of a ${D} mm aperture (stars to about ${fmt(lim)}).`);
      else if (m > lim - 3) add("challenging", `Close to the faint limit of a ${D} mm aperture (stars to about ${fmt(lim)}).`);
    }
    const sb = surfaceBrightness(target);
    if (sb !== undefined && (target.category === "galaxy" || target.category === "nebula")) {
      if (sb > SB_OUT_OF_REACH) add("out_of_reach", `Too faint per unit area to see by eye (about ${fmt(sb)} mag/arcsec²).`);
      else if (sb > SB_CHALLENGING) add("challenging", `Low surface brightness (about ${fmt(sb)} mag/arcsec²): needs a dark sky and averted vision.`);
    }
    const e = spec.eyepiece;
    if (e && valid(e.focalLengthMm, e.apparentFovDeg)) {
      const mag = optics.magnification(efl, e.focalLengthMm);
      const fieldArcsec = (e.fieldStopMm ? optics.trueFovFromFieldStop(e.fieldStopMm, efl) : optics.trueFovFromApparent(e.apparentFovDeg, mag)) * 3600;
      if (major > OVERSIZE * fieldArcsec) add("challenging", `Larger than the ${fmt(fieldArcsec / 60, 0)}′ field at ${fmt(mag, 0)}×: only part fits. A longer eyepiece shows more.`);
    }
  } else {
    const c = spec.camera;
    if (c && valid(c.pixelSizeUm, c.sensorWidthMm, c.sensorHeightMm)) {
      const scale = cam.imageScale(c.pixelSizeUm, efl);
      const px = major / scale;
      if (px < PX_OUT_OF_REACH) add("out_of_reach", `Only about ${fmt(px)} px across on this sensor: too small to show detail. A longer focal length or a Barlow helps.`);
      else if (px < PX_CHALLENGING) add("challenging", `Small on this sensor (about ${fmt(px, 0)} px across).`);
      const fov = Math.max(cam.sensorFovArcsec(c.sensorWidthMm, efl), cam.sensorFovArcsec(c.sensorHeightMm, efl));
      if (major > OVERSIZE * fov) add("challenging", `Larger than the ${fmt(fov / 60, 0)}′ sensor field: only part fits.`);
    }
  }

  const reach = found.reduce<Reach>((worst, f) => (RANK[f.reach] > RANK[worst] ? f.reach : worst), "good");
  return { reach, reasons: found.sort((a, b) => RANK[b.reach] - RANK[a.reach]).map((f) => f.reason) };
}

/** The more limiting of two assessments (e.g. when comparing two setups). */
export function worstReach(a: ReachAssessment, b: ReachAssessment): ReachAssessment {
  return RANK[a.reach] >= RANK[b.reach] ? a : b;
}
