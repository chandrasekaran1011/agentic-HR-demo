#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Flushing Redis..."
docker exec hr-agent-redis redis-cli FLUSHDB

echo "Reseeding master data and candidates..."
cd "$REPO_ROOT"
npx tsx scripts/seed.ts

echo "Demo ready. Open http://localhost:3000"
