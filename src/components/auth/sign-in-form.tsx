"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/observatory";
}

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string }>();

  if (!isSupabaseConfigured) {
    return (
      <p className="text-sm text-muted">
        Accounts are not enabled in this deployment. Your data is saved in this browser instead.
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(undefined);
    const supabase = getSupabaseBrowserClient();
    const { data, error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setMessage({ tone: "error", text: error.message });
      return;
    }
    if (mode === "sign-up" && !data.session) {
      setMessage({ tone: "info", text: "Check your email to confirm your account, then sign in." });
      return;
    }
    router.replace(safeNext(next));
    router.refresh();
  }

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor={emailId} className="block text-sm text-muted">
          Email
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor={passwordId} className="block text-sm text-muted">
          Password
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {mode === "sign-up" && <p className="text-xs text-muted">At least 8 characters.</p>}
      </div>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-danger" : "text-prov-retrieved"}`}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-accent-strong px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-40"
      >
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </button>
      <p className="text-center text-sm text-muted">
        {mode === "sign-in" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setMessage(undefined);
          }}
          className="text-accent hover:underline"
        >
          {mode === "sign-in" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
