"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { linkError } from "./link-error";

/**
 * Landing page of the password-reset email. The Supabase client exchanges the
 * link's code for a short-lived session on load (PKCE, so the link must open
 * in the browser that asked for it); with that session the password can be set.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const passwordId = useId();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [problem, setProblem] = useState<string>();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isSupabaseConfigured) return setState("invalid");
    const fromLink = linkError(window.location);
    if (fromLink) {
      setProblem(fromLink);
      return setState("invalid");
    }
    // getSession waits for the client to finish exchanging the link's code.
    getSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => setState(data.session ? "ready" : "invalid"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/observatory");
    router.refresh();
  }

  if (state === "checking") return <p role="status" className="text-sm text-muted">Checking your reset link…</p>;
  if (state === "invalid")
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p>{problem ?? "This reset link is invalid or has expired, or it was opened in a different browser."}</p>
        <Link href="/sign-in" className="text-accent hover:underline">
          Request a new link
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor={passwordId} className="block text-sm text-muted">
          New password
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <p className="text-xs text-muted">At least 8 characters.</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-accent-strong px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-40"
      >
        Set new password
      </button>
    </form>
  );
}
