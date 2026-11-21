#!/usr/bin/env bash
# Open (or reopen) the public HTTPS tunnel to the dev server, so a phone can
# open the app (AR needs HTTPS). The app reads the current address from
# .tunnel.url, so a new tunnel needs no restart of the dev server.
#
#   scripts/tunnel.sh [start|restart|stop]     PORT=3000  TUNNEL=cloudflared|ngrok
#
# Quick tunnels get a random address, and anyone with it can reach this dev
# server while the tunnel is open.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
TUNNEL="${TUNNEL:-cloudflared}"
PID_FILE=".tunnel.pid"
LOG=".tunnel.log"
URL_FILE=".tunnel.url"

log() { printf '\033[1;34m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*" >&2; }

running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }

stop_tunnel() {
  if running; then
    log "Closing the tunnel (PID $(cat "$PID_FILE"))…"
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
  fi
  rm -f "$PID_FILE" "$URL_FILE"
}

case "${1:-start}" in
  stop)
    stop_tunnel
    exit 0
    ;;
  restart) stop_tunnel ;;
  start)
    if running && [ -s "$URL_FILE" ]; then
      log "The tunnel is already open: $(cat "$URL_FILE")"
      exit 0
    fi
    ;;
  *)
    echo "usage: $0 [start|restart|stop]" >&2
    exit 2
    ;;
esac

url=""
case "$TUNNEL" in
  cloudflared)
    command -v cloudflared >/dev/null 2>&1 || { warn "cloudflared not found (brew install cloudflared)."; exit 1; }
    log "Opening a Cloudflare tunnel…"
    # HTTP/2 over TCP: steadier than the default QUIC (UDP), which drops on some
    # networks and after the computer sleeps, and then cannot reconnect.
    nohup cloudflared tunnel --no-autoupdate --protocol http2 --url "http://localhost:$PORT" >"$LOG" 2>&1 &
    pid=$!
    for _ in $(seq 1 60); do
      url="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" 2>/dev/null | head -1 || true)"
      [ -n "$url" ] && break
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    ;;
  ngrok)
    command -v ngrok >/dev/null 2>&1 || { warn "ngrok not found (brew install ngrok)."; exit 1; }
    log "Opening an ngrok tunnel…"
    nohup ngrok http "$PORT" --log stdout >"$LOG" 2>&1 &
    pid=$!
    for _ in $(seq 1 60); do
      url="$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -oE '"public_url":"https://[^"]+"' | head -1 | cut -d'"' -f4 || true)"
      [ -n "$url" ] && break
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    ;;
  *)
    warn "Unknown TUNNEL=$TUNNEL (use cloudflared or ngrok)."
    exit 1
    ;;
esac

if [ -z "$url" ]; then
  warn "The tunnel did not come up (details in $LOG)."
  kill "$pid" 2>/dev/null || true
  exit 1
fi

echo "$pid" >"$PID_FILE"
echo "$url" >"$URL_FILE"
printf '\n\033[1;32m  On your phone, open:  %s\033[0m\n' "$url"
node -e "require('qrcode').toString(process.argv[1], { type: 'terminal', small: true }).then((s) => console.log(s))" "$url" 2>/dev/null || true
printf '  Anyone with this address can open this dev server while the tunnel is open.\n\n'
