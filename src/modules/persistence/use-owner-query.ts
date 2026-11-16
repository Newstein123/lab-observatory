"use client";

import { useAuth } from "@/modules/auth/use-auth";
import { useRepositoryQuery, type QueryState } from "./client";
import type { ObservatoryRepository } from "./repository";

export type OwnerQueryState<T> = QueryState<T> | { status: "signed-out"; data?: undefined; error?: undefined };

/** A repository read for the user's own data; reports "signed-out" instead of an auth error. */
export function useOwnerQuery<T>(query: (repo: ObservatoryRepository) => Promise<T>, deps: unknown[]): OwnerQueryState<T> {
  const auth = useAuth();
  // Don't ask the server for private data while signed out (it would only refuse).
  const allowed = auth.mode === "local" || auth.status === "signed-in";
  const state = useRepositoryQuery((r) => (allowed ? query(r) : new Promise<T>(() => {})), [...deps, allowed]);
  if (auth.mode === "supabase") {
    if (auth.status === "loading") return { status: "loading" };
    if (auth.status === "signed-out") return { status: "signed-out" };
  }
  return state;
}
