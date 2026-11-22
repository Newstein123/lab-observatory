"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { linkError } from "./link-error";

/** Only same-site relative paths. */
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/observatory");

/**
 * Landing page of the sign-up confirmation email: the client exchanges the
 * link's code for a session on load, then this sends the user on.
 */
export function AuthCallback() {
  const router = useRouter();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    if (!isSupabaseConfigured) return setProblem("Accounts are not enabled in this deployment.");
    const fromLink = linkError(window.location);
    if (fromLink) return setProblem(fromLink);
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    getSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace(next);
        else setProblem("Your email is confirmed. Sign in to continue.");
      });
  }, [router]);

  if (!problem) return <p role="status" className="text-sm text-muted">Signing you in…</p>;
  return (
    <div role="alert" className="space-y-3 text-sm">
      <p>{problem}</p>
      <Link href="/sign-in" className="text-accent hover:underline">
        Go to sign in
      </Link>
    </div>
  );
}
