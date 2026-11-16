# Local development shortcuts. Run `make` or `make help` to list them.
.DEFAULT_GOAL := help
PORT ?= 3000
TUNNEL ?= cloudflared
.PHONY: help start stop restart status test

help: ## List available commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36mmake %-8s\033[0m %s\n", $$1, $$2}'

start: ## Start Docker, Supabase, a public HTTPS tunnel for phones and the app; Ctrl+C stops all (PORT=3001, TUNNEL=ngrok|0)
	@PORT=$(PORT) TUNNEL=$(TUNNEL) ./scripts/start.sh

stop: ## Stop the app and Supabase (from any terminal)
	@./scripts/stop.sh

restart: stop start ## Stop, then start again

status: ## Show whether the app, the tunnel and Supabase are running
	@if [ -f .dev-server.pid ] && kill -0 $$(cat .dev-server.pid) 2>/dev/null; then echo "App:      running (PID $$(cat .dev-server.pid))"; else echo "App:      stopped"; fi
	@if [ -f .tunnel.pid ] && kill -0 $$(cat .tunnel.pid) 2>/dev/null; then echo "Tunnel:   $$(grep -oE 'https://[a-z0-9.-]+\.(trycloudflare\.com|ngrok-free\.app|ngrok\.app|ngrok\.io)' .tunnel.log 2>/dev/null | head -1)"; else echo "Tunnel:   closed"; fi
	@if docker info >/dev/null 2>&1 && pnpm exec supabase status >/dev/null 2>&1; then echo "Supabase: running (API http://127.0.0.1:54321)"; else echo "Supabase: stopped"; fi

test: ## Run unit, database and browser tests (needs Supabase running)
	pnpm test && pnpm test:db && pnpm test:e2e
