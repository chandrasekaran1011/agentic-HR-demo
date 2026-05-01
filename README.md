# HR Onboarding Agent — Demo

Multi-agent HR onboarding demo for a 3000-person townhall.

## Status

**Phase 3 of 4 complete.** Chat sidebar (text) + voice agent (Azure OpenAI Realtime) both wired, sharing the same three tools and the same conversation thread. Mock-LLM fallback when keys aren't set. **Phase 4 = polish + master-data admin UI.**

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
```

Visit `http://localhost:3000`. Login `hr` / `acme2026`.

### Try the chat agent
Type into the sidebar:
- *"What's the status of Priya Sharma?"* → agent calls `lookup_status`
- *"Onboard Karan Shah, Senior Frontend Engineer, AI Platform team, joining May 12"* → agent calls `start_onboarding`, the cascade fires, you watch tiles flip
- *"Actually, change Karan's team to AI Infrastructure"* → agent calls `amend_onboarding`, affected tiles re-run

### Try voice
Click the mic button. Browser connects directly to Azure OpenAI Realtime via WebRTC. Speak the same kinds of requests; transcripts join the chat thread.

### Manual fallback
The candidates table has an **"Onboard manually"** button on pending rows for offline/recovery scenarios.

## Tests

```bash
npm test                            # vitest unit tests
npm run test:e2e                    # 5 tests, ~11s
```

## Mock mode (offline dev)

Without any cloud credentials:
- **Chat:** returns canned "ok" responses (no real reasoning)
- **Voice:** shows a friendly "set keys to enable" message
- **Email:** logged to stdout, `email.sent` events still fire (toast appears)
- **Tavily:** empty results (welcome agent skips accommodation suggestions)

The cascade and UI work without any Azure account.

## Environment variables

See [`.env.example`](.env.example) for the full list. Key ones:

| Variable | Required for | Notes |
|---|---|---|
| `COMPANY_NAME`, `COMPANY_BRAND_COLOR`, … | Branding | Threaded into UI + email templates |
| `AZURE_OPENAI_CHAT_ENDPOINT` + `_API_KEY` + `_API_VERSION` + `_DEPLOYMENT` | Text chat | Foundry chat resource (gpt-5, gpt-4o, etc.) |
| `AZURE_OPENAI_REALTIME_ENDPOINT` + `_API_KEY` + `_API_VERSION` + `_DEPLOYMENT` | Voice | Foundry realtime resource (often a different region) |
| `AZURE_COMM_CONNECTION_STRING` + `_SENDER_ADDRESS` | Real email | Mock fallback otherwise |
| `TAVILY_API_KEY` | Relocation hotel suggestions | Welcome email enrichment |

Chat and voice may live on **different Azure resources** with different endpoints, keys, API versions, and deployments. Each set is read independently. Legacy `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_API_KEY` still work as a fallback when chat and voice share a single resource.

After editing `.env`, copy to `packages/portal/.env` and `packages/orchestrator/.env`, then restart `npm run portal` and `npm run orchestrator` — Next.js does not hot-reload env vars.

## Auth

**Demo only — do not deploy.** Plaintext passwords in env. No rate limiting, no CSRF.

## Architecture

```
Browser ──HTTP──▶ Portal :3000 ──HTTP──▶ Orchestrator :3001
   │ ▲                  │                       │
   │ │                  ▼                       ▼
   │ └─ SSE /api/events ◀── Redis pub/sub agent:events
   │
   └─ WebRTC ────────────▶ Azure OpenAI Realtime API (direct)
```

Portal mints ephemeral Realtime sessions via orchestrator's `/voice/session`. Tool calls from voice are POSTed back to portal's `/api/voice/tool`, which proxies to orchestrator. Same three tools (`lookup_status`, `start_onboarding`, `amend_onboarding`) for chat and voice.

## Wow moments status

| ID | What | Status |
|---|---|---|
| W1 | Constellation tile light-up | ✅ Phase 2 |
| W2 | Reasoning stream | ✅ Phase 2 |
| W3 | Real email toast on inbox preview | ✅ Phase 2 (mock; real ACS when configured) |
| W4 | Stopwatch + savings counter | ✅ Phase 2 |
| W5 | Live correction via voice or chat | ✅ Phase 3 |
| W9 | Voice round-trip closing | ✅ Phase 3 (system prompt encourages it) |

## Layout

```
master-data/                  versioned config: roles, software matrix, teams, …
seed-data/candidates.json     4 demo candidates
packages/shared/              types + Zod schemas
packages/portal/              Next.js 15 App Router app (UI + thin API + SSE)
  app/api/chat                SSE proxy to orchestrator /chat
  app/api/voice/{token,tool}  voice session mint + tool execution proxy
  components/chat-sidebar.tsx persistent chat thread
  components/voice-agent.tsx  Realtime API + WebRTC hook
packages/orchestrator/        Fastify + supervisor + 12 sub-agents + email
  src/agent-tools             3 tools shared by chat + voice
  src/supervisor              compute desired state, diff, run-cascade
  src/agents                  12 sub-agents
  src/email                   MJML render + ACS client
scripts/seed.ts               load master + seed into Redis
scripts/reset-demo.sh         flush + reseed
deploy/docker-compose*.yml    redis + portal + orchestrator
e2e/                          playwright tests
```

## What Phase 4 will add

- Master data admin UI (Role × Software / Training matrix screens)
- Big-number reveal animation on `/admin`
- Polish on animations, spacing, typography (frontend-design skill pass)
- `npm run rehearse` mock-LLM dry-run script
- Final demo prep checklist + day-of script
