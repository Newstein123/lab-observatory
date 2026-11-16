"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Authentication state. In "local" mode (no Supabase configured) data stays
 * in this browser and no sign-in is needed.
 */
export type AuthState =
  | { mode: "local" }
  | { mode: "supabase"; status: "loading" }
  | { mode: "supabase"; status: "signed-out" }
  | { mode: "supabase"; status: "signed-in"; email: string; userId: string };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(
    isSupabaseConfigured ? { mode: "supabase", status: "loading" } : { mode: "local" },
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    const apply = (user: { id: string; email?: string } | null | undefined) =>
      setState(
        user
          ? { mode: "supabase", status: "signed-in", email: user.email ?? "", userId: user.id }
          : { mode: "supabase", status: "signed-out" },
      );
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user));
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

/** True when the user can read and write saved data. */
export function canPersist(auth: AuthState): boolean {
  return auth.mode === "local" || auth.status === "signed-in";
}

/** Sign-in URL that returns to the current page afterwards. */
export function signInHref(): string {
  if (typeof window === "undefined") return "/sign-in";
  return `/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}
