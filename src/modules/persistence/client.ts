"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { createBrowserStore, createLocalRepository } from "./local-repository";
import type { ObservatoryRepository } from "./repository";
import { createSupabaseRepository } from "./supabase-repository";

/**
 * Client-side access to the active repository: Supabase when configured
 * (NEXT_PUBLIC_SUPABASE_URL + key), otherwise browser-only storage.
 * Callers depend only on the ObservatoryRepository interface.
 */
let instance: ObservatoryRepository | null = null;

export function getRepository(): ObservatoryRepository {
  if (typeof window === "undefined") throw new Error("The repository is only available in the browser.");
  instance ??= isSupabaseConfigured
    ? createSupabaseRepository(getSupabaseBrowserClient())
    : createLocalRepository(createBrowserStore(), {
        onCorruptData: (key) => console.warn(`Saved data could not be read and was moved to "${key}".`),
      });
  return instance;
}

export type QueryState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "ready"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: Error };

/** Run a read against the repository and re-run it whenever data changes. */
export function useRepositoryQuery<T>(query: (repo: ObservatoryRepository) => Promise<T>, deps: unknown[]): QueryState<T> {
  const [state, setState] = useState<QueryState<T>>({ status: "loading" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(query, deps);

  useEffect(() => {
    let cancelled = false;
    const repo = getRepository();
    const load = () =>
      run(repo).then(
        (data) => !cancelled && setState({ status: "ready", data }),
        (error: unknown) => !cancelled && setState({ status: "error", error: error instanceof Error ? error : new Error(String(error)) }),
      );
    load();
    const off = repo.subscribe(load);
    return () => {
      cancelled = true;
      off();
    };
  }, [run]);

  return state;
}
