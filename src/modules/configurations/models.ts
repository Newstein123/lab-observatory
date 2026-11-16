import { z } from "zod";
import { canonicalJson } from "@/lib/canonical-json";
import type {
  BarlowSpec,
  CameraSpec,
  EyepieceSpec,
  ExposureSettings,
  FilterSpec,
  ObservingConditions,
  SimulationInput,
  SimulationMode,
  TargetExtent,
  TelescopeOptics,
} from "@/modules/simulations/engine";
import {
  barlowSpecSchema,
  cameraSpecSchema,
  eyepieceSpecSchema,
  filterSpecSchema,
  telescopeOpticsSchema,
} from "@/modules/simulations/engine";
import { mountSpecSchema, type MountSpec } from "@/modules/equipment/models";

/** Organisational labels only — not shopping or purchase states (spec §5.2). */
export type ConfigurationStatus = "owned" | "experimental" | "planned";

export const CONFIGURATION_STATUSES: { value: ConfigurationStatus; label: string }[] = [
  { value: "owned", label: "Owned" },
  { value: "experimental", label: "Experimental" },
  { value: "planned", label: "Planned" },
];

/**
 * The editable content of a configuration: a specific optical/imaging setup,
 * not the telescope itself (spec §5.2).
 *
 * `telescope` is always stored inline so a configuration is self-contained
 * and can be snapshotted. When linked to an equipment profile, `profileId`
 * records the link and `telescope` mirrors that profile's optics.
 */
export interface ConfigurationSpec {
  name: string;
  status: ConfigurationStatus;
  profileId?: string;
  /** Telescope catalogue entry this setup started from (identification only). */
  catalogRef?: string;
  telescope: TelescopeOptics;
  mount?: MountSpec;
  eyepiece?: EyepieceSpec;
  camera?: CameraSpec;
  barlow?: BarlowSpec;
  filter?: FilterSpec;
  notes?: string;
}

/** A saved configuration. `version` increments on every update. */
export interface TelescopeConfiguration extends ConfigurationSpec {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const configurationSpecSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  status: z.enum(["owned", "experimental", "planned"]),
  profileId: z.string().min(1).optional(),
  catalogRef: z.string().min(1).max(100).optional(),
  telescope: telescopeOpticsSchema,
  mount: mountSpecSchema.optional(),
  eyepiece: eyepieceSpecSchema.optional(),
  camera: cameraSpecSchema.optional(),
  barlow: barlowSpecSchema.optional(),
  filter: filterSpecSchema.optional(),
  notes: z.string().max(2000).optional(),
});

export const telescopeConfigurationSchema = configurationSpecSchema.extend({
  id: z.string().min(1),
  version: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Strip storage metadata, leaving only the editable spec. */
export function specOf(config: TelescopeConfiguration): ConfigurationSpec {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, version, createdAt, updatedAt, ...spec } = config;
  return spec;
}

/** Stable comparison of two specs (ignores undefined keys and key order). */
export function specsEqual(a: ConfigurationSpec, b: ConfigurationSpec): boolean {
  return canonicalJson(a) === canonicalJson(b);
}


/** One-line summary for lists, e.g. "200 mm f/5 · 25 mm eyepiece · APS-C camera". */
export function summarizeConfiguration(spec: ConfigurationSpec): string {
  const t = spec.telescope;
  const parts = [`${t.apertureMm} mm f/${(t.focalLengthMm / t.apertureMm).toFixed(1)}`];
  if (spec.eyepiece) parts.push(`${spec.eyepiece.focalLengthMm} mm eyepiece`);
  if (spec.barlow) parts.push(`${spec.barlow.factor}× Barlow`);
  if (spec.camera) parts.push(spec.camera.label ?? `${spec.camera.pixelSizeUm} µm camera`);
  if (spec.filter) parts.push(spec.filter.name);
  return parts.join(" · ");
}

export interface SimulationRequest {
  configuration: ConfigurationSpec;
  target: TargetExtent;
  mode: SimulationMode;
  conditions: ObservingConditions;
  exposure?: ExposureSettings;
}

/** Map a configuration plus run parameters to the engine's input. */
export function toSimulationInput({
  configuration,
  target,
  mode,
  conditions,
  exposure,
}: SimulationRequest): SimulationInput {
  return {
    mode,
    optics: configuration.telescope,
    eyepiece: configuration.eyepiece,
    camera: configuration.camera,
    barlow: configuration.barlow,
    filter: configuration.filter,
    target,
    conditions,
    ...(mode === "camera" && exposure ? { exposure } : {}),
  };
}
