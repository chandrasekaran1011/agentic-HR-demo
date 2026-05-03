# syntax=docker/dockerfile:1
#
# Orchestrator runs TypeScript directly via `tsx` — same as dev mode.
# Single stage: install deps in place so per-package node_modules (e.g. mjml,
# which npm refuses to hoist) end up where Node's resolver looks for them.

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# 1. Lockfile + workspace stubs — cached unless deps change
COPY package*.json tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/orchestrator/package*.json ./packages/orchestrator/
RUN npm ci --include=dev

# 2. Source — invalidates only on code changes
COPY packages/shared ./packages/shared
COPY packages/orchestrator ./packages/orchestrator
COPY master-data ./master-data
COPY seed-data ./seed-data

EXPOSE 3001
CMD ["node_modules/.bin/tsx", "packages/orchestrator/src/server.ts"]
