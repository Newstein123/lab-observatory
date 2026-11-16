import type { ConfigurationSpec } from "@/modules/configurations/models";
import { CAMERA_CATALOG, EYEPIECE_CATALOG, MOUNT_CATALOG, type TelescopeCatalogEntry } from "@/modules/equipment/catalog";
import type { MountSpec, MountType, TelescopeProfile } from "@/modules/equipment/models";
import type { TelescopeOptics } from "@/modules/simulations/engine";

/** A sensible starting mount for a mount type (descriptive only). */
export function defaultMount(type: MountType, otaWeightKg?: number): MountSpec {
  const pick = (id: string) => MOUNT_CATALOG.find((m) => m.id === id)!.spec;
  switch (type) {
    case "dobsonian":
      return pick("mount-dob-base");
    case "equatorial":
      return otaWeightKg && otaWeightKg > 9 ? pick("skywatcher-eq6r-pro") : pick("skywatcher-eq5");
    case "goto":
      return { type: "alt_azimuth", goto: true, tracking: true, label: "Computerised alt-azimuth (GoTo)" };
    case "alt_azimuth":
      return pick("mount-altaz-manual");
  }
}

const STARTER_EYEPIECE = EYEPIECE_CATALOG.find((e) => e.id === "ep-25-50")!.spec;
const STARTER_CAMERA = CAMERA_CATALOG.find((c) => c.id === "zwo-asi533mc-pro")!.spec;

function starter(name: string, telescope: TelescopeOptics, mount: MountSpec): ConfigurationSpec {
  return { name: name.slice(0, 100), status: "experimental", telescope, mount, eyepiece: STARTER_EYEPIECE, camera: STARTER_CAMERA };
}

export function specFromCatalog(entry: TelescopeCatalogEntry): ConfigurationSpec {
  return { ...starter(`My ${entry.model}`, entry.optics, defaultMount(entry.mountType, entry.otaWeightKg)), catalogRef: entry.id };
}

export function specFromProfile(profile: TelescopeProfile): ConfigurationSpec {
  const label = [profile.manufacturer, profile.model].filter(Boolean).join(" ") || undefined;
  return {
    ...starter(`${profile.name} setup`, {
      apertureMm: profile.apertureMm,
      focalLengthMm: profile.focalLengthMm,
      opticalDesign: profile.opticalDesign,
      ...(label ? { label } : {}),
    }, defaultMount(profile.mountType)),
    status: profile.status,
    profileId: profile.id,
  };
}

export function specFromCustom(input: {
  name?: string;
  optics: TelescopeOptics;
  mountType: MountType;
  manufacturer?: string;
  model?: string;
}): ConfigurationSpec {
  const label = [input.manufacturer, input.model].filter(Boolean).join(" ") || undefined;
  const name = input.name?.trim() || `Custom ${input.optics.apertureMm} mm f/${(input.optics.focalLengthMm / input.optics.apertureMm).toFixed(1)}`;
  const { label: _ignored, ...optics } = input.optics; // eslint-disable-line @typescript-eslint/no-unused-vars
  return starter(name, { ...optics, ...(label ? { label } : {}) }, defaultMount(input.mountType));
}
