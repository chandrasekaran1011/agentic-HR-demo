#!/usr/bin/env bash
#
# Hard reset of the demo state:
#   1. FLUSHDB on whichever Redis container is currently running
#      (prod compose first, dev compose as a fallback)
#   2. Re-seed master data + candidates via scripts/seed.ts
#
# Honours REDIS_URL if you want to point the seed step at a different
# Redis (defaults to redis://localhost:6379, which is what the install.sh
# stack exposes on the VM).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PROD_COMPOSE="deploy/docker-compose.yml"
DEV_COMPOSE="deploy/docker-compose.dev.yml"

# Pick the compose file that has a running redis service.
COMPOSE_FILE=""
for f in "$PROD_COMPOSE" "$DEV_COMPOSE"; do
  if [[ -f "$f" ]] && docker compose -f "$f" ps -q redis 2>/dev/null | grep -q .; then
    COMPOSE_FILE="$f"
    break
  fi
done

if [[ -z "$COMPOSE_FILE" ]]; then
  echo "no running redis container found via docker compose" >&2
  echo "start the stack first:  sudo docker compose -f $PROD_COMPOSE up -d" >&2
  exit 1
fi

echo "Flushing Redis (compose: $COMPOSE_FILE)"
docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli FLUSHDB

echo "Reseeding master data and candidates"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}" npx tsx scripts/seed.ts

echo "Demo ready."
