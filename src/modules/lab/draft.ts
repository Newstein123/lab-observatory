"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import {
  configurationSpecSchema,
  specOf,
  specsEqual,
  telescopeConfigurationSchema,
  type ConfigurationSpec,
  type TelescopeConfiguration,
} from "@/modules/configurations/models";
import { DEFAULT_CONFIGURATION } from "@/modules/configurations/presets";

/**
 * The Telescope Lab's working copy: the configuration being edited and, if
 * it came from (or was saved as) a stored configuration, that record.
 *
 * Kept in browser storage so moving between Configure, Simulate and Compare,
 * or reloading, never loses edits. It is a per-device convenience: if storage
 * is unavailable the draft simply lives in memory for this page.
 */

export interface LabDraft {
  spec: ConfigurationSpec;
  saved?: TelescopeConfiguration;
}

export const DRAFT_KEY = "universal-observatory:lab-draft";

const draftSchema = z.object({
  spec: configurationSpecSchema,
  saved: telescopeConfigurationSchema.optional(),
});

let memory: LabDraft | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function read(): LabDraft | null {
  if (loaded) return memory;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    const parsed = raw ? draftSchema.safeParse(JSON.parse(raw)) : undefined;
    memory = parsed?.success ? (parsed.data as LabDraft) : null;
  } catch {
    memory = null;
  }
  return memory;
}

function write(next: LabDraft | null) {
  memory = next;
  loaded = true;
  try {
    if (next) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable or full: keep the in-memory draft.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === DRAFT_KEY) {
      loaded = false;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Start a new draft (replacing any current one). */
export function startDraft(spec: ConfigurationSpec, saved?: TelescopeConfiguration) {
  write({ spec: structuredClone(spec), saved });
}

/** Open a stored configuration for editing. */
export function openSavedInDraft(config: TelescopeConfiguration) {
  write({ spec: specOf(config), saved: config });
}

export function updateDraftSpec(update: ConfigurationSpec | ((spec: ConfigurationSpec) => ConfigurationSpec)) {
  const current = read() ?? { spec: DEFAULT_CONFIGURATION };
  const spec = typeof update === "function" ? update(current.spec) : update;
  write({ ...current, spec });
}

/** Record that the draft was saved as (or to) this configuration. */
export function markDraftSaved(config: TelescopeConfiguration) {
  write({ spec: specOf(config), saved: config });
}

export function clearDraft() {
  write(null);
}

export function getDraft(): LabDraft | null {
  return typeof window === "undefined" ? null : read();
}

/** Has the working copy changed since it was last saved (or never been saved)? */
export function isDraftDirty(draft: LabDraft): boolean {
  return !draft.saved || !specsEqual(draft.spec, specOf(draft.saved));
}

/**
 * Subscribe to the draft. `null` means there is no draft yet (or, during
 * server rendering, that it is not known yet: check `hydrated`).
 */
export function useLabDraft(): { draft: LabDraft | null; hydrated: boolean } {
  const draft = useSyncExternalStore(subscribe, read, () => null);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return { draft, hydrated };
}

/** Test helper: forget cached state. */
export function resetDraftCacheForTests() {
  memory = null;
  loaded = false;
}
