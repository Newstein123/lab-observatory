import { z } from "zod";
import { deepEqualJson } from "@/lib/canonical-json";
import {
  configurationSpecSchema,
  toSimulationInput,
  type ConfigurationSpec,
} from "@/modules/configurations/models";
import {
  ENGINE_VERSION,
  exposureSettingsSchema,
  observingConditionsSchema,
  simulate,
  SimulationInputError,
  type ExposureSettings,
  type ObservingConditions,
  type SimulationMode,
  type SimulationResult,
} from "@/modules/simulations/engine";
import { toTargetExtent, type CuratedTarget } from "@/modules/targets/catalogue";

/**
 * A saved simulation (spec §6.2, FR-11). Everything needed to reproduce it is
 * copied in at save time, so later edits to configurations or the target
 * catalogue never rewrite history.
 */

/** Viewport-only settings; they affect rendering, not calculated results. */
export interface SessionViewSettings {
  focusOffset: number;
  longExposureColor: boolean;
  zoom: number;
  /** When the view is set (ISO 8601): places moving things such as Jupiter's moons. */
  observedAt?: string;
  /** Where it was observed from (coordinates rounded to 0.1°). */
  site?: { name: string; latDeg: number; lonDeg: number; timeZone?: string };
  /** Where the conditions came from. */
  conditionsSource?: "live" | "manual" | "ideal";
  /** What made the sky bright (sets the drawn sky colour). */
  skySource?: "natural" | "light pollution" | "moonlight" | "twilight";
  /** Cloud cover 0…1 as drawn. */
  cloud?: number;
}

export interface NewSession {
  name: string;
  mode: SimulationMode;
  targetSnapshot: CuratedTarget;
  conditions: ObservingConditions;
  exposure?: ExposureSettings;
  view: SessionViewSettings;
  /** Link to the saved configuration this came from, if any (informational only). */
  configurationRef?: { id: string; version: number; modified: boolean };
  /** The authoritative, frozen configuration used for the calculation. */
  configurationSnapshot: ConfigurationSpec;
  engineVersion: string;
  result: SimulationResult;
}

export interface SimulationSession extends NewSession {
  id: string;
  createdAt: string;
}

interface BuildSessionArgs {
  name?: string;
  configuration: ConfigurationSpec;
  configurationRef?: NewSession["configurationRef"];
  target: CuratedTarget;
  mode: SimulationMode;
  conditions: ObservingConditions;
  exposure?: ExposureSettings;
  view: SessionViewSettings;
}

const clone = <T>(v: T): T => structuredClone(v);

/**
 * Build a session from current inputs. The result is recomputed here from the
 * snapshot rather than trusted from the UI, so stored inputs and outputs are
 * guaranteed to correspond. Throws SimulationInputError on invalid input.
 */
export function buildSession(args: BuildSessionArgs): NewSession {
  // Parsing strips storage metadata (id, version…) and anything unexpected.
  const parsed = configurationSpecSchema.safeParse(clone(args.configuration));
  if (!parsed.success) {
    throw new SimulationInputError(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  const configurationSnapshot = parsed.data as ConfigurationSpec;
  const targetSnapshot = clone(args.target);
  const exposure = args.mode === "camera" && args.exposure ? clone(args.exposure) : undefined;
  const result = simulate(
    toSimulationInput({
      configuration: configurationSnapshot,
      target: toTargetExtent(targetSnapshot),
      mode: args.mode,
      conditions: args.conditions,
      exposure,
    }),
  );
  return {
    name: args.name?.trim() || `${targetSnapshot.name} · ${args.mode === "eyepiece" ? "Eyepiece" : "Camera"}`,
    mode: args.mode,
    targetSnapshot,
    conditions: clone(args.conditions),
    ...(exposure ? { exposure } : {}),
    view: clone(args.view),
    ...(args.configurationRef ? { configurationRef: { ...args.configurationRef } } : {}),
    configurationSnapshot,
    engineVersion: result.engineVersion,
    result,
  };
}

export interface ReproductionCheck {
  savedVersion: string;
  currentVersion: string;
  /** True when re-running the snapshot with the current engine gives identical metrics. */
  identical: boolean;
}

/** Re-run a saved session's snapshot with the current engine and compare. */
export function checkReproduction(session: SimulationSession): ReproductionCheck {
  let identical = false;
  try {
    const rerun = simulate(
      toSimulationInput({
        configuration: session.configurationSnapshot,
        target: toTargetExtent(session.targetSnapshot),
        mode: session.mode,
        conditions: session.conditions,
        exposure: session.exposure,
      }),
    );
    identical = deepEqualJson(rerun.metrics, session.result.metrics);
  } catch {
    identical = false;
  }
  return { savedVersion: session.engineVersion, currentVersion: ENGINE_VERSION, identical };
}

/**
 * Storage validation. Results and target snapshots are produced by our own
 * code and stored verbatim; they are checked structurally, not field by field.
 */
export const simulationSessionSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  name: z.string().max(200),
  mode: z.enum(["eyepiece", "camera"]),
  targetSnapshot: z.object({ id: z.string(), name: z.string() }).passthrough(),
  conditions: observingConditionsSchema,
  exposure: exposureSettingsSchema.optional(),
  view: z.object({
    focusOffset: z.number(),
    longExposureColor: z.boolean(),
    zoom: z.number(),
    observedAt: z.string().datetime().optional(),
    site: z
      .object({ name: z.string().max(120), latDeg: z.number().min(-90).max(90), lonDeg: z.number().min(-180).max(180), timeZone: z.string().max(64).optional() })
      .optional(),
    conditionsSource: z.enum(["live", "manual", "ideal"]).optional(),
    skySource: z.enum(["natural", "light pollution", "moonlight", "twilight"]).optional(),
    cloud: z.number().min(0).max(1).optional(),
  }),
  configurationRef: z.object({ id: z.string(), version: z.number(), modified: z.boolean() }).optional(),
  configurationSnapshot: configurationSpecSchema,
  engineVersion: z.string(),
  result: z.object({ engineVersion: z.string(), mode: z.enum(["eyepiece", "camera"]) }).passthrough(),
});
