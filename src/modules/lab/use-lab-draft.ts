"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CONFIGURATION } from "@/modules/configurations/presets";
import { getRepository } from "@/modules/persistence/client";
import { openSavedInDraft, startDraft, useLabDraft, type LabDraft } from "./draft";

export type DraftStatus = "loading" | "ready" | "missing-config" | "error";

/**
 * The draft a Lab page works on. With `?config=<id>`, that saved
 * configuration is opened (unless the draft already holds it, so unsaved
 * edits survive navigation). Without a draft, the example setup is used.
 */
export function useWorkingDraft(configId?: string): { draft: LabDraft | null; status: DraftStatus } {
  const { draft, hydrated } = useLabDraft();
  const [status, setStatus] = useState<DraftStatus>("loading");
  const needsLoad = hydrated && Boolean(configId) && draft?.saved?.id !== configId;

  useEffect(() => {
    if (!hydrated) return;
    if (!needsLoad) {
      if (!draft) startDraft(DEFAULT_CONFIGURATION);
      setStatus((s) => (s === "missing-config" || s === "error" ? s : "ready"));
      return;
    }
    let cancelled = false;
    setStatus("loading");
    getRepository()
      .getConfiguration(configId!)
      .then((c) => {
        if (cancelled) return;
        if (c) {
          openSavedInDraft(c);
          setStatus("ready");
        } else {
          if (!draft) startDraft(DEFAULT_CONFIGURATION);
          setStatus("missing-config");
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (!draft) startDraft(DEFAULT_CONFIGURATION);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, needsLoad, configId]);

  return { draft: hydrated && !needsLoad ? draft : null, status: hydrated && !needsLoad && draft ? (status === "loading" ? "ready" : status) : "loading" };
}
