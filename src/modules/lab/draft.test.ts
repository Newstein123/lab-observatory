// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { TelescopeConfiguration } from "@/modules/configurations/models";
import { DEFAULT_CONFIGURATION } from "@/modules/configurations/presets";
import {
  DRAFT_KEY,
  clearDraft,
  getDraft,
  isDraftDirty,
  markDraftSaved,
  resetDraftCacheForTests,
  startDraft,
  updateDraftSpec,
} from "./draft";

const storage = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
    addEventListener() {},
    removeEventListener() {},
  },
});

const saved: TelescopeConfiguration = {
  ...DEFAULT_CONFIGURATION,
  id: "c1",
  version: 3,
  createdAt: "2026-11-15T00:00:00.000Z",
  updatedAt: "2026-11-15T00:00:00.000Z",
};

describe("lab draft", () => {
  beforeEach(() => {
    storage.clear();
    resetDraftCacheForTests();
  });

  it("persists edits across reloads", () => {
    startDraft(DEFAULT_CONFIGURATION);
    updateDraftSpec((s) => ({ ...s, name: "Edited" }));
    resetDraftCacheForTests();
    expect(getDraft()?.spec.name).toBe("Edited");
  });

  it("tracks whether the working copy differs from the saved configuration", () => {
    startDraft(DEFAULT_CONFIGURATION);
    expect(isDraftDirty(getDraft()!)).toBe(true);
    markDraftSaved(saved);
    expect(isDraftDirty(getDraft()!)).toBe(false);
    updateDraftSpec((s) => ({ ...s, eyepiece: { focalLengthMm: 10, apparentFovDeg: 52 } }));
    expect(isDraftDirty(getDraft()!)).toBe(true);
    expect(getDraft()?.saved?.id).toBe("c1");
  });

  it("ignores unreadable stored drafts", () => {
    storage.set(DRAFT_KEY, JSON.stringify({ spec: { name: "" } }));
    expect(getDraft()).toBeNull();
    storage.set(DRAFT_KEY, "{oops");
    resetDraftCacheForTests();
    expect(getDraft()).toBeNull();
  });

  it("clears", () => {
    startDraft(DEFAULT_CONFIGURATION);
    clearDraft();
    resetDraftCacheForTests();
    expect(getDraft()).toBeNull();
  });
});
