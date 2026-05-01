# HR Onboarding Agent — Demo

Multi-agent HR onboarding demo for a 3000-person townhall.

## Status

**Phase 2 of 4 complete.** Orchestrator service with multi-agent supervisor + 12 sub-agents, MJML email templates via Azure ACS, SSE-driven live UI (tile flips, reasoning stream, stopwatch, savings counter, email inbox toast). HTTP-trigger an onboarding cascade and watch tiles flip green in the browser. **No voice yet — Phase 3.**

See [docs/superpowers/specs/2026-05-01-hr-onboarding-agent-demo-design.md](docs/superpowers/specs/2026-05-01-hr-onboarding-agent-demo-design.md) for the full design.

## Quick start

```bash
cp .env.example .env
cp .env packages/portal/.env       # Next.js loads env from package dir
cp .env packages/orchestrator/.env

npm install
npm run redis                       # docker compose up redis
npm run reset                       # FLUSHDB + seed master data + 4 candidates

# In separate terminals:
npm run orchestrator                # tsx watch, port 3001
npm run portal                      # next dev, port 3000

# Or all-in-one:
npm run dev
```

Visit `http://localhost:3000`. Login `hr` / `acme2026`. Click **Onboard** on a pending candidate (e.g. Karan Shah) and watch the cascade.

## Tests

```bash
npm test                            # vitest unit tests
npm run test:e2e                    # playwright (4 tests, ~10s)
```

## Mock-mode fallback

When `AZURE_OPENAI_API_KEY` is unset, LLM calls return deterministic responses. When `AZURE_COMM_CONNECTION_STRING` is unset, emails are logged to stdout instead of sent. When `TAVILY_API_KEY` is unset, web search returns empty (welcome agent falls back to non-relocation template). This means **the full cascade runs offline without any cloud accounts.**

## Auth

**Demo only. Do not deploy.** Plaintext passwords in env. No rate limiting, no CSRF.

## Layout

```
master-data/                  versioned config: roles, software matrix, teams, …
seed-data/candidates.json     4 demo candidates
packages/shared/              types + Zod schemas
packages/portal/              Next.js 15 App Router app (UI + thin API + SSE)
packages/orchestrator/        Fastify + supervisor + 12 sub-agents + email
scripts/seed.ts               load master + seed into Redis
scripts/reset-demo.sh         flush + reseed
deploy/docker-compose*.yml    redis + portal + orchestrator
e2e/                          playwright tests (smoke + cascade)
```

## Architecture

```
Browser ──HTTP──▶ Portal :3000 ──HTTP──▶ Orchestrator :3001
   ▲                  │                       │
   │                  ▼                       ▼
   └─ SSE /api/events ◀── Redis pub/sub agent:events
```

- Supervisor reads master data, computes desired state, dispatches sub-agents in 3 waves (HRMS solo → 9 parallel → manager+welcome).
- Each sub-agent commits a tile/audit/event triplet to Redis through `commitSystemAction`.
- Portal SSE forwards events to the browser; React components animate tile flips via Framer Motion.

## Wow moments wired in Phase 2

| ID | What | Status |
|---|---|---|
| W1 | Constellation tile light-up | ✅ |
| W2 | Reasoning stream | ✅ |
| W3 | Real email toast on inbox preview | ✅ (mock send works; real ACS when configured) |
| W4 | Stopwatch + savings counter | ✅ |

## What Phase 3 will add

- Azure OpenAI Realtime API in browser (WebRTC)
- Voice tools: `lookup_status`, `start_onboarding`, `amend_onboarding`
- Narration cue injection from server → browser → Realtime session
- W5 mic-drop amend flow end-to-end (the "Actually, AI Infrastructure" moment)
- W9 voice round-trip closing

## What Phase 4 will add

- Master data admin UI (Role × Software / Training matrix screens)
- Big-number reveals on `/admin`
- Polish on animations, spacing, typography
- `npm run rehearse` mock-LLM dry-run script
