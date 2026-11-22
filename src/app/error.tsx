"use client";

import Link from "next/link";
import { useEffect } from "react";
import { buttonStyles } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

/** Any page that throws while rendering: keep the header, explain, offer a way back. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Until an error-monitoring service is wired in, at least leave a trace.
    console.error("Page error", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-16">
      <ErrorState
        title="This page ran into a problem"
        message="Your saved setups and sessions are safe. Try again, or go back to the Lab."
        onRetry={reset}
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/lab" className={buttonStyles({ size: "sm" })}>
          Telescope Lab
        </Link>
        <Link href="/" className={buttonStyles({ variant: "ghost", size: "sm" })}>
          Home
        </Link>
      </div>
      {error.digest && <p className="text-xs text-muted">Reference: {error.digest}</p>}
    </main>
  );
}
