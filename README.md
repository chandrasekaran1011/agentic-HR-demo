# HR Onboarding Agent — Demo

Multi-agent HR onboarding demo built for a 3000-person townhall.

## Status

**Phase 1 of 4 complete.** Portal scaffold, auth, persistent storage, candidates table, candidate detail page (read-only), system CRUD pages, and admin dashboard. **No agent runtime yet** — Phase 2 adds the orchestrator.

See [docs/superpowers/specs/2026-05-01-hr-onboarding-agent-demo-design.md](docs/superpowers/specs/2026-05-01-hr-onboarding-agent-demo-design.md) for full design.

## Quick start

```bash
cp .env.example .env
cp .env packages/portal/.env       # Next.js loads env from package dir
npm install
npm run redis                       # docker compose up redis
npm run reset                       # FLUSHDB + seed master data + 4 candidates
npm --workspace=portal run dev      # next dev on :3000
```

Visit `http://localhost:3000`. Login with `hr` / `acme2026`.

## Auth

**This auth is for demo only. Do not deploy.** Plaintext passwords in env vars, no rate limiting, no CSRF.

## Tests

```bash
npm test                            # vitest unit tests
npm run test:e2e                    # playwright smoke tests (requires redis + seeded data)
```

## Layout

- `master-data/` — versioned config (roles, software matrix, teams, …)
- `seed-data/candidates.json` — 4 demo candidates
- `packages/shared/` — TypeScript types and Zod schemas
- `packages/portal/` — Next.js 15 App Router app
- `scripts/seed.ts` — load master-data + seed candidates into Redis
- `scripts/reset-demo.sh` — flush + reseed
- `e2e/` — Playwright smoke tests
- `deploy/` — docker-compose files (cloud deployment is out of scope here)

## What Phase 2 will add

- `packages/orchestrator/` — Fastify service on port 3001
- Supervisor agent + 12 sub-agents
- Common toolbelt + master-data lookup tools
- MJML email templates + Azure Communication Services
- SSE event stream from Redis pub/sub → browser
- HTTP-triggered cascade (no voice yet — Phase 3)
- W1 tile animations driven by SSE
- W2 reasoning stream
- W4 stopwatch + savings counter
- Idempotent sub-agent base middleware
- Desired-state diff for amendments
