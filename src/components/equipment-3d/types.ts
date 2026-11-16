import type { MountSpec } from "@/modules/equipment/models";
import type { MountPose } from "./mount-model";
import type { TrainSpec } from "./optical-train";
import type { PartId } from "./parts";
import type { BarlowSpec, CameraSpec, EyepieceSpec, FilterSpec, TelescopeOptics } from "@/modules/simulations/engine";

/** Anything the equipment stage can show. */
export type StageItem =
  | { kind: "telescope"; optics: TelescopeOptics; mount?: MountSpec }
  | { kind: "mount"; spec: MountSpec; optics?: TelescopeOptics }
  | { kind: "eyepiece"; spec: EyepieceSpec }
  | { kind: "camera"; spec: CameraSpec }
  | { kind: "barlow"; spec: BarlowSpec }
  | { kind: "filter"; spec: FilterSpec }
  /** The whole setup: mount, tube and the accessories in the focuser. */
  | {
      kind: "rig";
      optics: TelescopeOptics;
      mount?: MountSpec;
      train: TrainSpec;
      focusMm?: number;
      pose?: MountPose;
      /** Frame the camera on this part (e.g. the eyepiece just chosen). */
      focusPart?: PartId;
    };

/** Stable identity for refitting the camera when the item changes. */
export function stageItemKey(item: StageItem): string {
  // A rig keeps its framing while accessories, focus and pose change.
  if (item.kind === "rig") return `rig:${JSON.stringify([item.optics, item.mount])}`;
  return `${item.kind}:${JSON.stringify(item)}`;
}

/** What is fitted in the focuser right now (a part can be in the configuration but taken out). */
export interface FittedParts {
  mode: TrainSpec["mode"];
  barlow?: boolean;
  filter?: boolean;
  /** The eyepiece (visual) or camera (imaging). */
  top?: boolean;
}

/** The whole setup for the stage, built from a configuration. */
export function rigItem(
  spec: {
    telescope: TelescopeOptics;
    mount?: MountSpec;
    eyepiece?: EyepieceSpec;
    camera?: CameraSpec;
    barlow?: BarlowSpec;
    filter?: FilterSpec;
  },
  fitted: FittedParts,
  extra: { focusMm?: number; pose?: MountPose; focusPart?: PartId } = {},
): Extract<StageItem, { kind: "rig" }> {
  const top = fitted.top ?? true;
  return {
    kind: "rig",
    optics: spec.telescope,
    mount: spec.mount,
    train: {
      mode: fitted.mode,
      barlow: (fitted.barlow ?? true) ? spec.barlow : undefined,
      filter: (fitted.filter ?? true) ? spec.filter : undefined,
      eyepiece: top ? spec.eyepiece : undefined,
      camera: top ? spec.camera : undefined,
    },
    ...extra,
  };
}
