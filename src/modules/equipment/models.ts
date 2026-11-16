import { z } from "zod";
import type {
  BarlowSpec,
  CameraSpec,
  EyepieceSpec,
  FilterSpec,
  OpticalDesign,
} from "@/modules/simulations/engine";
import {
  barlowSpecSchema,
  cameraSpecSchema,
  eyepieceSpecSchema,
  filterSpecSchema,
} from "@/modules/simulations/engine";

/**
 * Physical (or planned) equipment in the user's observatory (spec §5.1).
 * Manufacturer and model are identification metadata only: calculations
 * always use the optical specification.
 */

/** Organisational labels only — not shopping or purchase states. */
export type EquipmentStatus = "owned" | "experimental" | "planned";

export const EQUIPMENT_STATUSES: { value: EquipmentStatus; label: string }[] = [
  { value: "owned", label: "Owned" },
  { value: "experimental", label: "Experimental" },
  { value: "planned", label: "Planned" },
];

const statusSchema = z.enum(["owned", "experimental", "planned"]);

export type MountType = "alt_azimuth" | "equatorial" | "dobsonian" | "goto";

export const MOUNT_TYPES: { value: MountType; label: string }[] = [
  { value: "alt_azimuth", label: "Alt-azimuth" },
  { value: "equatorial", label: "Equatorial" },
  { value: "dobsonian", label: "Dobsonian" },
  { value: "goto", label: "GoTo" },
];

export const OPTICAL_DESIGNS: { value: OpticalDesign; label: string }[] = [
  { value: "refractor", label: "Refractor" },
  { value: "reflector", label: "Reflector / Newtonian" },
  { value: "catadioptric", label: "Catadioptric (SCT / Maksutov)" },
];

export function labelOf<T extends string>(options: { value: T; label: string }[], value: T | undefined): string {
  return options.find((o) => o.value === value)?.label ?? "";
}

const optionalText = (max: number) => z.string().trim().max(max).optional();

// ---------------------------------------------------------------------------
// Telescopes
// ---------------------------------------------------------------------------

export interface TelescopeProfileInput {
  name: string;
  status: EquipmentStatus;
  opticalDesign: OpticalDesign;
  apertureMm: number;
  focalLengthMm: number;
  mountType: MountType;
  manufacturer?: string;
  model?: string;
  notes?: string;
}

export interface TelescopeProfile extends TelescopeProfileInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const telescopeProfileInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  // Records saved before statuses existed are treated as owned.
  status: statusSchema.default("owned"),
  opticalDesign: z.enum(["refractor", "reflector", "catadioptric"]),
  apertureMm: z.number().finite().min(10).max(10_000),
  focalLengthMm: z.number().finite().min(50).max(100_000),
  mountType: z.enum(["alt_azimuth", "equatorial", "dobsonian", "goto"]),
  manufacturer: optionalText(100),
  model: optionalText(100),
  notes: optionalText(2000),
});

export const telescopeProfileSchema = telescopeProfileInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Mounts (descriptive; no effect on optical calculations)
// ---------------------------------------------------------------------------

export interface MountSpec {
  type: MountType;
  /** Manufacturer's rated payload, kg (visual use). */
  payloadKg?: number;
  goto?: boolean;
  /** Motorised sidereal tracking. */
  tracking?: boolean;
  label?: string;
}

export const mountSpecSchema = z.object({
  type: z.enum(["alt_azimuth", "equatorial", "dobsonian", "goto"]),
  payloadKg: z.number().finite().min(0.1).max(1000).optional(),
  goto: z.boolean().optional(),
  tracking: z.boolean().optional(),
  label: z.string().max(100).optional(),
});

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------

export type AccessoryKind = "eyepiece" | "camera" | "barlow" | "filter" | "mount";

export const ACCESSORY_KINDS: { value: AccessoryKind; label: string; plural: string }[] = [
  { value: "eyepiece", label: "Eyepiece", plural: "Eyepieces" },
  { value: "camera", label: "Camera", plural: "Cameras" },
  { value: "barlow", label: "Barlow lens", plural: "Barlow lenses" },
  { value: "filter", label: "Filter", plural: "Filters" },
  { value: "mount", label: "Mount", plural: "Mounts" },
];

interface AccessoryBase {
  name: string;
  status: EquipmentStatus;
  manufacturer?: string;
  model?: string;
  notes?: string;
}

/** A component kind paired with its specification. */
export type AccessorySpecPair =
  | { kind: "eyepiece"; spec: EyepieceSpec }
  | { kind: "camera"; spec: CameraSpec }
  | { kind: "barlow"; spec: BarlowSpec }
  | { kind: "filter"; spec: FilterSpec }
  | { kind: "mount"; spec: MountSpec };

export type AccessoryInput = AccessoryBase & AccessorySpecPair;

export type Accessory = AccessoryInput & { id: string; createdAt: string; updatedAt: string };

const accessoryBase = {
  name: z.string().trim().min(1, "Name is required").max(100),
  status: statusSchema,
  manufacturer: optionalText(100),
  model: optionalText(100),
  notes: optionalText(2000),
};

export const accessoryInputSchema = z.discriminatedUnion("kind", [
  z.object({ ...accessoryBase, kind: z.literal("eyepiece"), spec: eyepieceSpecSchema }),
  z.object({ ...accessoryBase, kind: z.literal("camera"), spec: cameraSpecSchema }),
  z.object({ ...accessoryBase, kind: z.literal("barlow"), spec: barlowSpecSchema }),
  z.object({ ...accessoryBase, kind: z.literal("filter"), spec: filterSpecSchema }),
  z.object({ ...accessoryBase, kind: z.literal("mount"), spec: mountSpecSchema }),
]);

const storedMeta = { id: z.string().min(1), createdAt: z.string(), updatedAt: z.string() };

export const accessorySchema = z.discriminatedUnion("kind", [
  z.object({ ...accessoryBase, ...storedMeta, kind: z.literal("eyepiece"), spec: eyepieceSpecSchema }),
  z.object({ ...accessoryBase, ...storedMeta, kind: z.literal("camera"), spec: cameraSpecSchema }),
  z.object({ ...accessoryBase, ...storedMeta, kind: z.literal("barlow"), spec: barlowSpecSchema }),
  z.object({ ...accessoryBase, ...storedMeta, kind: z.literal("filter"), spec: filterSpecSchema }),
  z.object({ ...accessoryBase, ...storedMeta, kind: z.literal("mount"), spec: mountSpecSchema }),
]);

/** One-line technical summary of an accessory spec. */
export function describeAccessory(a: AccessorySpecPair): string {
  switch (a.kind) {
    case "eyepiece":
      return `${a.spec.focalLengthMm} mm · ${a.spec.apparentFovDeg}°${a.spec.barrelIn ? ` · ${a.spec.barrelIn}″` : ""}`;
    case "camera":
      return `${a.spec.sensorWidthMm}×${a.spec.sensorHeightMm} mm · ${a.spec.pixelSizeUm} µm${a.spec.color === false ? " · mono" : a.spec.color ? " · colour" : ""}`;
    case "barlow":
      return `${a.spec.factor}×${a.spec.barrelIn ? ` · ${a.spec.barrelIn}″` : ""}`;
    case "filter":
      return a.spec.name;
    case "mount":
      return `${labelOf(MOUNT_TYPES, a.spec.type)}${a.spec.payloadKg ? ` · ${a.spec.payloadKg} kg payload` : ""}${a.spec.goto ? " · GoTo" : ""}`;
  }
}
