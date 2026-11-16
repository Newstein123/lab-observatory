import type { CameraSpec, EyepieceSpec, TelescopeOptics } from "@/modules/simulations/engine";
import {
  CAMERA_CATALOG,
  EYEPIECE_CATALOG,
  MOUNT_CATALOG,
  TELESCOPE_CATALOG,
  displayName,
  getTelescopeEntry,
} from "@/modules/equipment/catalog";
import type { ConfigurationSpec } from "./models";

/** Quick-pick specifications drawn from the equipment catalogue. */
export interface Preset<T> {
  id: string;
  label: string;
  spec: T;
}

export const TELESCOPE_PRESETS: Preset<TelescopeOptics>[] = TELESCOPE_CATALOG.map((t) => ({
  id: t.id,
  label: `${displayName(t)} (${t.optics.apertureMm} mm f/${(t.optics.focalLengthMm / t.optics.apertureMm).toFixed(1)})`,
  spec: t.optics,
}));

export const EYEPIECE_PRESETS: Preset<EyepieceSpec>[] = EYEPIECE_CATALOG.filter((e) => !e.manufacturer).map((e) => ({
  id: e.id,
  label: `${e.spec.focalLengthMm} mm, ${e.spec.apparentFovDeg}°`,
  spec: e.spec,
}));

export const CAMERA_PRESETS: Preset<CameraSpec>[] = CAMERA_CATALOG.map((c) => ({ id: c.id, label: displayName(c), spec: c.spec }));

const defaultScope = getTelescopeEntry("skywatcher-explorer-200p")!;

export const DEFAULT_CONFIGURATION: ConfigurationSpec = {
  name: "My 200 mm Newtonian",
  status: "experimental",
  catalogRef: defaultScope.id,
  telescope: defaultScope.optics,
  mount: MOUNT_CATALOG.find((m) => m.id === "skywatcher-heq5-pro")!.spec,
  eyepiece: EYEPIECE_CATALOG.find((e) => e.id === "ep-25-50")!.spec,
  camera: CAMERA_CATALOG.find((c) => c.id === "zwo-asi2600mc-pro")!.spec,
};
