"use client";

import { useEffect } from "react";
import "./globals.css";

/** Last resort, when the root layout itself fails: it replaces <html>, so it can't rely on the header or providers. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App error", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <main className="mx-auto max-w-xl space-y-3 px-4 py-16">
          <h1 className="text-lg font-semibold">Universal Observatory ran into a problem</h1>
          <p className="text-sm text-muted">Your saved setups and sessions are safe. Reload to try again.</p>
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="rounded-lg border border-border-strong px-3 py-1.5 text-sm hover:border-accent">
              Try again
            </button>
            {/* A full page load, not client navigation: the app shell itself failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="rounded-lg border border-border-strong px-3 py-1.5 text-sm hover:border-accent">
              Home
            </a>
          </div>
          {error.digest && <p className="text-xs text-muted">Reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
