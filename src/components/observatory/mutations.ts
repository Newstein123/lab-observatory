"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/toast";

/** Run a repository mutation, reporting success or failure as a toast. */
export function useMutation() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const out = await fn();
        if (success) toast(success);
        return out;
      } catch (e) {
        toast(e instanceof Error ? e.message : "Something went wrong.", "error");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy };
}
