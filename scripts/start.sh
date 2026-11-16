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
TUNNEL_PID_FILE=".tunnel.pid"
TUNNEL_LOG=".tunnel.log"
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
  if [ -n "${TUNNEL_PID:-}" ]; then
    log "Closing the tunnel…"
    kill "$TUNNEL_PID" 2>/dev/null || true
    wait "$TUNNEL_PID" 2>/dev/null || true
  fi
  rm -f "$TUNNEL_PID_FILE"
  log "Stopping Supabase…"
  pnpm exec supabase stop >/dev/null 2>&1 || true
  log "Stopped."
}
trap cleanup EXIT
# Ctrl+C is the normal way to stop, so exit cleanly (no 'make: *** Error 130').
trap 'exit 0' INT TERM

# 4. Public HTTPS tunnel, so a phone can open the app (AR needs HTTPS).
#    Started before the app; it connects as soon as the app is listening.
start_tunnel() {
  case "$TUNNEL" in
    0 | off | none | false) return 0 ;;
    cloudflared)
      command -v cloudflared >/dev/null 2>&1 || { warn "cloudflared not found (brew install cloudflared); continuing without a tunnel."; return 0; }
      log "Opening a Cloudflare tunnel…"
      cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" >"$TUNNEL_LOG" 2>&1 &
      TUNNEL_PID=$!
      for _ in $(seq 1 60); do
        PUBLIC_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)"
        [ -n "$PUBLIC_URL" ] && break
        kill -0 "$TUNNEL_PID" 2>/dev/null || break
        sleep 0.5
      done
      ;;
    ngrok)
      command -v ngrok >/dev/null 2>&1 || { warn "ngrok not found (brew install ngrok); continuing without a tunnel."; return 0; }
      log "Opening an ngrok tunnel…"
      ngrok http "$PORT" --log stdout >"$TUNNEL_LOG" 2>&1 &
      TUNNEL_PID=$!
      for _ in $(seq 1 60); do
        PUBLIC_URL="$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -oE '"public_url":"https://[^"]+"' | head -1 | cut -d'"' -f4 || true)"
        [ -n "$PUBLIC_URL" ] && break
        kill -0 "$TUNNEL_PID" 2>/dev/null || break
        sleep 0.5
      done
      ;;
    *) warn "Unknown TUNNEL=$TUNNEL (use cloudflared, ngrok or 0); continuing without a tunnel."; return 0 ;;
  esac
  if [ -z "$PUBLIC_URL" ]; then
    warn "The tunnel did not come up (details in $TUNNEL_LOG); continuing on localhost only."
    kill "$TUNNEL_PID" 2>/dev/null || true
    TUNNEL_PID=""
    return 0
  fi
  echo "$TUNNEL_PID" >"$TUNNEL_PID_FILE"
}
start_tunnel

if [ -n "$PUBLIC_URL" ]; then
  printf '\n\033[1;32m  On your phone, open:  %s\033[0m\n' "$PUBLIC_URL"
  # Scannable from the terminal.
  node -e "require('qrcode').toString(process.argv[1], { type: 'terminal', small: true }).then((s) => console.log(s))" "$PUBLIC_URL" 2>/dev/null || true
  printf '  Anyone with this address can open this dev server while it runs. Start with TUNNEL=0 to keep it local.\n\n'
fi

log "Starting the app on http://localhost:$PORT  (Ctrl+C to stop everything)"
NEXT_PUBLIC_DEV_PUBLIC_ORIGIN="$PUBLIC_URL" ./node_modules/.bin/next dev --turbopack --port "$PORT" &
DEV_PID=$!
echo "$DEV_PID" > "$PID_FILE"
wait "$DEV_PID"
