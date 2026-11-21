#!/usr/bin/env bash
# Stop the app and Supabase from any terminal. Leaves Docker Desktop running
# (other projects may use it). Safe to run when nothing is running.
set -uo pipefail
cd "$(dirname "$0")/.."

PID_FILE=".dev-server.pid"
log() { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }

if [ -f "$PID_FILE" ]; then
  pid="$(cat "$PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    log "Stopping the app (PID $pid)…"
    kill "$pid" 2>/dev/null
    for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
  fi
  rm -f "$PID_FILE"
fi

./scripts/tunnel.sh stop

if docker info >/dev/null 2>&1; then
  log "Stopping Supabase…"
  pnpm exec supabase stop >/dev/null 2>&1 || true
fi
log "Stopped."
