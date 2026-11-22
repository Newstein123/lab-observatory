"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { signInHref, useAuth } from "@/modules/auth/use-auth";

export function AccountMenu() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.mode === "local" || auth.status === "loading") return null;

  if (auth.status === "signed-out") {
    return (
      <Link href={signInHref()} className="whitespace-nowrap rounded-lg border border-border-strong px-3 py-1.5 text-sm hover:border-accent">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
      <span className="flex min-w-0 items-center gap-2" title={auth.email}>
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#c9b8ff,#6c7bff_55%,#3b2a9e)] text-xs font-semibold uppercase text-white"
        >
          {auth.email?.[0] ?? "?"}
        </span>
        <span className="hidden max-w-[16rem] truncate text-muted sm:inline">{auth.email}</span>
      </span>
      <button
        type="button"
        onClick={async () => {
          await getSupabaseBrowserClient().auth.signOut();
          router.push("/");
          router.refresh();
        }}
        aria-label="Sign out"
        title="Sign out"
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border-strong p-2 hover:border-accent sm:px-3 sm:py-1.5"
      >
        {/* Small screens: icon only (the name stays as the accessible label). */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4 sm:hidden" aria-hidden>
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
          <path d="M10 16l-4-4 4-4M6 12h10" />
        </svg>
        <span className="max-sm:hidden">Sign out</span>
      </button>
    </div>
  );
}

/** Shown in place of private content when the user must sign in. */
export function SignInPrompt({ children }: { children?: React.ReactNode }) {
  return (
    <div className="glass rounded-xl border-dashed p-8 text-center">
      <p className="text-sm text-muted">{children ?? "Sign in to see your equipment, configurations and saved sessions."}</p>
      <Link
        href={signInHref()}
        className="mt-4 inline-block rounded-lg bg-accent-strong px-4 py-2 text-sm font-medium text-accent-foreground shadow-glow hover:bg-accent"
      >
        Sign in
      </Link>
    </div>
  );
}
