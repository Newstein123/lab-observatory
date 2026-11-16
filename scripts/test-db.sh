#!/usr/bin/env sh
# Run the Supabase integration tests against the local stack (`supabase start` first).
set -e
eval "$(pnpm exec supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY)=')"
if [ -z "$API_URL" ] || [ -z "$PUBLISHABLE_KEY" ]; then
  echo "Local Supabase is not running. Start it with: pnpm exec supabase start" >&2
  exit 1
fi
SUPABASE_TEST_URL="$API_URL" SUPABASE_TEST_KEY="$PUBLISHABLE_KEY" exec pnpm exec vitest run src/modules/persistence/supabase-repository.test.ts "$@"
