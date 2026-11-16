import type { ConfigurationSpec } from "@/modules/configurations/models";
import type { Provenance } from "@/modules/simulations/engine";
import { EYE_PUPIL_MM } from "@/modules/simulations/engine";
import { getTelescopeEntry } from "./catalog";

/**
 * Practical compatibility notes for a configuration. Pure and independent
 * of the UI. Each note says how it was obtained (calculated from the specs,
 * or estimated from rules of thumb).
 */

export type NoteLevel = "ok" | "warning" | "info";
export interface CompatibilityNote {
  id: string;
  level: NoteLevel;
  title: string;
  detail: string;
  kind: Provenance;
}

/** Rough optical-tube weight, kg, from aperture and design. */
export function estimateOtaWeightKg(spec: ConfigurationSpec["telescope"]): number {
  const A = spec.apertureMm;
  switch (spec.opticalDesign) {
    case "refractor":
      return 2.5 * (A / 80) ** 2.2;
    case "catadioptric":
      return 5.7 * (A / 203) ** 2.2;
    default:
      return 8.5 * (A / 200) ** 2 * Math.sqrt(spec.focalLengthMm / 1000);
  }
}

export function checkCompatibility(spec: ConfigurationSpec): CompatibilityNote[] {
  const notes: CompatibilityNote[] = [];
  const entry = getTelescopeEntry(spec.catalogRef);
  const focuser = entry?.focuserBarrelIn;
  const t = spec.telescope;
  const barlow = spec.barlow?.factor ?? 1;

  if (spec.eyepiece?.barrelIn === 2 && focuser === 1.25) {
    notes.push({
      id: "eyepiece-barrel",
      level: "warning",
      title: "2″ eyepiece on a 1.25″ focuser",
      detail: "The stock focuser of this telescope takes 1.25″ eyepieces. A 2″ visual back or diagonal is needed.",
      kind: "retrieved",
    });
  }
  if (spec.barlow?.barrelIn === 2 && focuser === 1.25) {
    notes.push({
      id: "barlow-barrel",
      level: "warning",
      title: "2″ Barlow on a 1.25″ focuser",
      detail: "This Barlow needs a 2″ focuser or visual back.",
      kind: "retrieved",
    });
  }
  if (spec.eyepiece?.barrelIn === 2 && spec.barlow?.barrelIn === 1.25) {
    notes.push({
      id: "barlow-eyepiece",
      level: "warning",
      title: "2″ eyepiece in a 1.25″ Barlow",
      detail: "The eyepiece will not fit this Barlow.",
      kind: "calculated",
    });
  }

  if (spec.eyepiece && t.apertureMm > 0 && spec.eyepiece.focalLengthMm > 0) {
    const mag = (t.focalLengthMm * barlow) / spec.eyepiece.focalLengthMm;
    const exitPupil = t.apertureMm / mag;
    const maxUseful = 2 * t.apertureMm;
    if (mag > maxUseful) {
      notes.push({
        id: "magnification",
        level: "warning",
        title: `${Math.round(mag)}× exceeds the usual maximum of ${Math.round(maxUseful)}×`,
        detail: "Above about 2× the aperture in mm, the image gets larger but not sharper.",
        kind: "calculated",
      });
    }
    if (exitPupil > EYE_PUPIL_MM) {
      notes.push({
        id: "exit-pupil",
        level: "warning",
        title: `Exit pupil ${exitPupil.toFixed(1)} mm is wider than the eye's pupil`,
        detail: `A dark-adapted eye opens to about ${EYE_PUPIL_MM} mm, so some of the light is wasted.`,
        kind: "calculated",
      });
    }
  }

  if (spec.mount) {
    const weight = entry?.otaWeightKg ?? estimateOtaWeightKg(t);
    const load = weight + (spec.camera ? 0.8 : 0) + 0.5;
    const payload = spec.mount.payloadKg;
    if (payload) {
      const ratio = load / payload;
      // Ratings are approximate and exclude counterweights; allow some margin.
      const imaging = Boolean(spec.camera);
      const note: CompatibilityNote =
        ratio > 1.15
          ? { id: "payload", level: "warning", title: "Mount likely overloaded", detail: `Estimated load ${load.toFixed(1)} kg against a rated ${payload} kg payload.`, kind: "estimated" }
          : ratio > 0.85
            ? { id: "payload", level: "warning", title: "Near the mount's rated payload", detail: `Estimated load ${load.toFixed(1)} kg of ${payload} kg rated. Fine for visual use; expect vibration${imaging ? " and tracking errors when imaging" : ""}.`, kind: "estimated" }
            : imaging && ratio > 0.6
              ? { id: "payload", level: "info", title: "Heavy for imaging", detail: `Estimated load ${load.toFixed(1)} kg of ${payload} kg rated; for imaging, about half the rating is a common rule of thumb.`, kind: "estimated" }
              : { id: "payload", level: "ok", title: "Within the mount's payload", detail: `Estimated load ${load.toFixed(1)} kg of ${payload} kg rated.`, kind: "estimated" };
      notes.push(note);
    }
    if (spec.camera && !spec.mount.tracking) {
      notes.push({
        id: "tracking",
        level: "info",
        title: "No motorised tracking",
        detail: "Stars will trail in camera exposures longer than a fraction of a second at this focal length.",
        kind: "calculated",
      });
    }
  }
  return notes;
}
