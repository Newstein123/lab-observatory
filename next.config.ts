import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * Separate output folders so processes never overwrite each other's files:
 *   - `next dev` → .next-dev   (your running dev server)
 *   - `next build` / `next start` → .next
 *   - NEXT_DIST_DIR overrides both (the e2e test server uses .next-e2e)
 * Sharing one folder let a build or a second dev server replace the CSS a
 * running dev server had compiled, so styles vanished on refresh.
 *
 * `allowedDevOrigins` lets the dev server answer pages opened through the
 * `make start` tunnel (Cloudflare quick tunnel or ngrok), e.g. on a phone.
 */
export default function config(phase: string): NextConfig {
  // Without Supabase the app quietly falls back to browser-only storage (no
  // accounts). Never let a production build do that by accident.
  const supabaseConfigured =
    process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (phase === PHASE_PRODUCTION_BUILD && !supabaseConfigured && process.env.ALLOW_BROWSER_ONLY_BUILD !== "1") {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set for a production build. " +
        "Set ALLOW_BROWSER_ONLY_BUILD=1 to build the browser-only (no accounts) version on purpose.",
    );
  }
  return {
    distDir: process.env.NEXT_DIST_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
    allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
  };
}
