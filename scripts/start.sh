#!/usr/bin/env bash
# Start everything for local development: Docker (if needed) → Supabase →
# public HTTPS tunnel (for testing on a phone, e.g. AR) → Next.js.
# Runs in the foreground; Ctrl+C (or `make stop` from another terminal) shuts
# down the app, the tunnel and Supabase. Docker Desktop itself is left running.
#
# TUNNEL=cloudflared (default; no account needed) | ngrok (needs `ngrok config
# add-authtoken`) | 0 (no tunnel). While a tunnel is open, anyone with its
# random address can reach this dev server.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
PID_FILE=".dev-server.pid"
TUNNEL="${TUNNEL:-cloudflared}"
PUBLIC_URL=""

log() { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*" >&2; }

# 0. The app's port must be free (checked first so nothing is started in vain).
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  holder="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1" (PID "$2")"}')"
  fail "Port $PORT is already in use by $holder. Stop it, or use another port: make start PORT=3001"
fi

# 1. Docker
if ! docker info >/dev/null 2>&1; then
  command -v open >/dev/null 2>&1 || fail "Docker is not running. Start it and try again."
  log "Starting Docker Desktop…"
  open -a Docker
  for _ in $(seq 1 60); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  docker info >/dev/null 2>&1 || fail "Docker did not start within 2 minutes."
fi

# 2. Supabase (no-op if already running)
log "Starting Supabase…"
pnpm exec supabase start >/dev/null || fail "Supabase failed to start. Run 'pnpm exec supabase start' to see why."

# 3. Next.js dev server; stop everything when it exits.
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  fail "The dev server is already running (PID $(cat "$PID_FILE")). Run 'make stop' first."
fi

cleanup() {
  trap - EXIT INT TERM
  [ -n "${DEV_PID:-}" ] && kill "$DEV_PID" 2>/dev/null || true
  wait "${DEV_PID:-}" 2>/dev/null || true
  rm -f "$PID_FILE"
  [ -n "${WATCH_PID:-}" ] && kill "$WATCH_PID" 2>/dev/null || true
  ./scripts/tunnel.sh stop >/dev/null 2>&1 || true
  log "Stopping Supabase…"
  pnpm exec supabase stop >/dev/null 2>&1 || true
  log "Stopped."
}
trap cleanup EXIT
# Ctrl+C is the normal way to stop, so exit cleanly (no 'make: *** Error 130').
trap 'exit 0' INT TERM

# 4. Public HTTPS tunnel, so a phone can open the app (AR needs HTTPS).
#    Started before the app; it connects as soon as the app is listening.
case "$TUNNEL" in
  0 | off | none | false) ;;
  *)
    if PORT="$PORT" TUNNEL="$TUNNEL" ./scripts/tunnel.sh restart; then
      PUBLIC_URL="$(cat .tunnel.url 2>/dev/null || true)"
    else
      warn "Continuing on localhost only."
    fi
    ;;
esac

# Keep the tunnel alive: quick tunnels can drop (a network change, the computer
# sleeping) and never come back. Check every minute and reopen it if it is gone.
# The app reads the current address itself, so the phone QR code follows.
watch_tunnel() {
  local fails=0 url pid code
  while sleep 60; do
    url="$(cat .tunnel.url 2>/dev/null || true)"
    pid="$(cat .tunnel.pid 2>/dev/null || true)"
    # Any answer from the app counts as alive; no answer (000) or Cloudflare's
    # own "tunnel not found" errors (502, 530 / error 1033) mean it is dead.
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url" 2>/dev/null || true)"
    if [ -n "$url" ] && [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && [ -n "$code" ] && [ "$code" != 000 ] && [ "$code" != 502 ] && [ "$code" != 530 ]; then
      fails=0
      continue
    fi
    fails=$((fails + 1))
    if [ "$fails" -ge 2 ]; then
      warn "The tunnel dropped; opening a new one…"
      PORT="$PORT" TUNNEL="$TUNNEL" ./scripts/tunnel.sh restart || true
      fails=0
    fi
  done
}
if [ -n "$PUBLIC_URL" ]; then
  watch_tunnel &
  WATCH_PID=$!
fi

log "Starting the app on http://localhost:$PORT  (Ctrl+C to stop everything)"
NEXT_PUBLIC_DEV_PUBLIC_ORIGIN="$PUBLIC_URL" ./node_modules/.bin/next dev --turbopack --port "$PORT" &
DEV_PID=$!
echo "$DEV_PID" > "$PID_FILE"
wait "$DEV_PID"
