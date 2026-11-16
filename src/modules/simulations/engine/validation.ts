import { z } from "zod";

/**
 * Input validation at the engine boundary. Ranges are deliberately generous
 * to permit hypothetical setups, but reject physically meaningless values.
 */

const positive = (min: number, max: number) => z.number().finite().min(min).max(max);

export const telescopeOpticsSchema = z.object({
  apertureMm: positive(10, 10_000),
  focalLengthMm: positive(50, 100_000),
  opticalDesign: z.enum(["refractor", "reflector", "catadioptric"]).optional(),
  label: z.string().max(100).optional(),
});

const barrelSchema = z.union([z.literal(1.25), z.literal(2)]);

export const eyepieceSpecSchema = z.object({
  focalLengthMm: positive(1, 100),
  apparentFovDeg: positive(20, 120),
  fieldStopMm: positive(1, 80).optional(),
  label: z.string().max(100).optional(),
  barrelIn: barrelSchema.optional(),
  eyeReliefMm: positive(1, 50).optional(),
});

export const cameraSpecSchema = z.object({
  sensorWidthMm: positive(1, 100),
  sensorHeightMm: positive(1, 100),
  pixelSizeUm: positive(0.5, 30),
  resolutionX: z.number().int().positive().max(100_000).optional(),
  resolutionY: z.number().int().positive().max(100_000).optional(),
  label: z.string().max(100).optional(),
  color: z.boolean().optional(),
});

export const barlowSpecSchema = z.object({
  factor: positive(1, 5),
  label: z.string().max(100).optional(),
  barrelIn: barrelSchema.optional(),
});

export const FILTER_KINDS = ["neutral_density", "uhc", "oiii", "light_pollution", "color_blue", "color_orange", "other"] as const;

export const filterSpecSchema = z.object({
  name: z.string().min(1).max(100),
  kind: z.enum(FILTER_KINDS).optional(),
});

export const targetExtentSchema = z.object({
  id: z.string().min(1).max(100),
  majorAxisArcsec: positive(0.001, 100_000),
  minorAxisArcsec: positive(0.001, 100_000),
  category: z.enum(["moon", "planet", "nebula", "galaxy", "cluster"]).optional(),
  declinationDeg: z.number().finite().min(-90).max(90).optional(),
});

export const observingConditionsSchema = z.object({
  seeingArcsec: positive(0.1, 20).optional(),
});

export const exposureSettingsSchema = z.object({
  exposureS: positive(0.0001, 3600),
  gain: positive(0.1, 1000),
  tracking: z.enum(["none", "sidereal"]).optional(),
});

export const simulationInputSchema = z
  .object({
    mode: z.enum(["eyepiece", "camera"]),
    optics: telescopeOpticsSchema,
    eyepiece: eyepieceSpecSchema.optional(),
    camera: cameraSpecSchema.optional(),
    barlow: barlowSpecSchema.optional(),
    filter: filterSpecSchema.optional(),
    target: targetExtentSchema,
    conditions: observingConditionsSchema,
    exposure: exposureSettingsSchema.optional(),
  })
  .superRefine((input, ctx) => {
    if (input.mode === "eyepiece" && !input.eyepiece) {
      ctx.addIssue({ code: "custom", path: ["eyepiece"], message: "Eyepiece mode requires an eyepiece." });
    }
    if (input.mode === "camera" && !input.camera) {
      ctx.addIssue({ code: "custom", path: ["camera"], message: "Camera mode requires a camera." });
    }
  });

export type ValidatedSimulationInput = z.infer<typeof simulationInputSchema>;
