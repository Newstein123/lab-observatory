import { z } from "zod";

/** A user-defined grouping of targets and saved simulation sessions. */
export interface ObservationProjectInput {
  name: string;
  description?: string;
  /** Catalogue target ids the project is about. */
  targetIds: string[];
}

export interface ObservationProject extends ObservationProjectInput {
  id: string;
  /** Saved sessions in this project, oldest first. */
  sessionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export const observationProjectInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(2000).optional(),
  targetIds: z.array(z.string().min(1).max(100)).max(50),
});

export const observationProjectSchema = observationProjectInputSchema.extend({
  id: z.string().min(1),
  sessionIds: z.array(z.string().min(1)),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const PROJECT_SUGGESTIONS: ObservationProjectInput[] = [
  { name: "Solar System Observation", description: "The Moon and bright planets at high magnification.", targetIds: ["moon", "jupiter", "saturn"] },
  { name: "Deep Sky Exploration", description: "Nebulae and galaxies at low power and long exposures.", targetIds: ["m42", "m31"] },
  { name: "Telescope Performance Testing", description: "Compare setups on the same targets and conditions.", targetIds: [] },
];
