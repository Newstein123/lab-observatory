import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

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
  return {
    distDir: process.env.NEXT_DIST_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
    allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
  };
}
