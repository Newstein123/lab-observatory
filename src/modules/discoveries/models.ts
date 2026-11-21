import { z } from "zod";

/**
 * A saved discovery: an object, or a feature of it (a crater, a moon, a ring,
 * a nebula region), bookmarked while observing. One per thing per user:
 * saving it again keeps the first record.
 */
export type DiscoveryKind = "object" | "feature" | "companion" | "ring";

export interface DiscoveryInput {
  /** Catalogue target id (e.g. "moon", "jupiter", "m42"). */
  targetId: string;
  kind: DiscoveryKind;
  /** The feature, moon or ring within the target; absent for the object itself. */
  featureId?: string;
  /** Name shown when it was saved, e.g. "Tycho" or "Great Red Spot". */
  name: string;
  /** The user's own note. */
  note?: string;
  /** When and where it was being observed when saved (ISO 8601; place name). */
  observedAt?: string;
  siteName?: string;
  /** The setup in use, e.g. "200 mm f/5 · 167×". */
  setupSummary?: string;
}

export interface Discovery extends DiscoveryInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const discoveryNoteSchema = z.string().trim().max(2000, "Notes are limited to 2,000 characters");

const id = z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, "Lower-case letters, digits and hyphens only");

export const discoveryInputSchema = z
  .object({
    targetId: id,
    kind: z.enum(["object", "feature", "companion", "ring"]),
    featureId: id.optional(),
    name: z.string().trim().min(1, "Name is required").max(120),
    note: discoveryNoteSchema.optional(),
    observedAt: z.iso.datetime({ offset: true }).optional(),
    siteName: z.string().trim().max(120).optional(),
    setupSummary: z.string().trim().max(200).optional(),
  })
  .refine((d) => (d.kind === "object") === (d.featureId === undefined), {
    message: "A feature, moon or ring needs its id; the object itself has none",
    path: ["featureId"],
  });

export const discoverySchema = z.object({
  targetId: z.string().min(1),
  kind: z.enum(["object", "feature", "companion", "ring"]),
  featureId: z.string().min(1).optional(),
  name: z.string().min(1),
  note: z.string().optional(),
  observedAt: z.string().optional(),
  siteName: z.string().optional(),
  setupSummary: z.string().optional(),
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** The identity of what was discovered (one record per user per key). */
export const discoveryKey = (d: Pick<DiscoveryInput, "targetId" | "kind" | "featureId">) => `${d.targetId}/${d.kind}/${d.featureId ?? ""}`;

/** Link back to the Lab with the discovery opened. */
export function discoveryHref(d: Pick<DiscoveryInput, "targetId" | "featureId">): string {
  const p = new URLSearchParams({ target: d.targetId });
  if (d.featureId) p.set("feature", d.featureId);
  return `/lab/simulate?${p}`;
}
