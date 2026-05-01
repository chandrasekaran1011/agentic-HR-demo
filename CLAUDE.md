# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Pre-implementation.** The design has been completed and approved through a brainstorming session. The authoritative source of truth is:

- [`docs/superpowers/specs/2026-05-01-hr-onboarding-agent-demo-design.md`](docs/superpowers/specs/2026-05-01-hr-onboarding-agent-demo-design.md)

Read that spec before doing any implementation work. It captures **24 locked-in decisions** including tech stack, agent architecture, demo choreography, data model, UI design, email templates, auth, branding, and risk mitigations.

No code has been written yet. The next step is writing an implementation plan (via the `superpowers:writing-plans` skill) which will decompose the spec into concrete, sequenced implementation phases.

## What this project is

An HR Onboarding Agent demo built for a 3000+ person company townhall. The demo target is **autonomy theatre**: an HR person speaks one command ("onboard Arjun Mehta, Senior BE, May 8, AI Platform"), and the audience watches ~12 mock back-office systems update autonomously in 60–90 seconds — compressing a week of manual onboarding work into stage time.

Demo runs locally on the presenter's laptop. The application is fully containerized so it can be deployed elsewhere (Azure Container Apps is the user's intended target, but cloud deployment / IaC / CI/CD are out of scope of this codebase — the user handles those separately).

## Architecture summary

Three processes, all running locally on one laptop for the demo:

| Process | Port | Stack | Responsibility |
|---|---|---|---|
| `portal` | 3000 | Next.js 15 App Router + Tailwind + shadcn/ui + Framer Motion | UI, thin API, SSE, ephemeral key minting for Realtime API |
| `orchestrator` | 3001 | Node + Fastify + Azure OpenAI SDK | Multi-agent supervisor + 12 sub-agents, sends emails via Azure ACS |
| `redis` | 6379 | Redis 7 (Docker) | Source of truth, audit trails, pub/sub event bus |

### Multi-agent design (read this before touching the orchestrator)

- **Voice agent** — Azure OpenAI Realtime API, runs in the browser via WebRTC. Three tools: `lookup_status`, `start_onboarding`, `amend_onboarding`. Spoken narration mid-cascade is server-pushed via 5–6 curated cues.
- **Onboarding Supervisor** — master agent in the orchestrator. Computes a "desired state" plan, dispatches sub-agents in 3 parallel waves, diffs and re-dispatches affected agents on amendment.
- **12 sub-agents** — one per mock system (HRMS, Document, Buddy, IT, Software, Training, ID Card, Payroll, Manager Notify, Seating, Parking, Welcome). Each is a function-calling LLM run with focused tools + a common toolbelt (master data lookups, time tools). Idempotent — re-running reconciles to new desired state.
- **Tavily web search** is scoped to the Welcome agent only, used for accommodation suggestions when the candidate is relocating.

### Wave dispatch (DAG, not strict sequence)

```
Wave 1 (solo):     HRMS                         → generates emp_id
Wave 2 (parallel): Documents, Buddy, IT, Software, Training,
                   ID Card, Payroll, Seating, Parking
Wave 3 (parallel): Manager Notify, Welcome     → reference prior artifacts
```

Wave 2 fires sub-agents in parallel via `Promise.all`. The 200–500ms artificial per-tile delay (gated by `DEMO_MODE=true`) makes individual UI flips visible from the back of a 3000-person hall.

## Data model

Single source of truth is Redis. Key namespaces:

- `candidate:{id}` — candidate profile hash
- `tile:{candidate_id}:{system}` — per-tile state
- `ticket:{system}:{id}` — per-system mock record
- `audit:{candidate_id}` — chronological event list
- `desired:{candidate_id}` — JSON of current desired state (for amendments)
- `master:*` — internal master data loaded from `master-data/*.json` at boot
- `agent:events` — single pub/sub channel for live UI updates

The portal subscribes once to `agent:events` and fans messages out via SSE to the browser. Filtering happens client-side.

## Common commands (planned — these don't exist yet)

When implementation is done, the workflow will be:

```bash
npm run dev              # docker-compose.dev.yml (redis only) + hot-reload portal & orchestrator
npm run reset            # FLUSHDB + reseed master-data + seed candidates
npm run rehearse         # full dry-run with mocked LLM responses (offline)
npm run preview-email    # renders all 5 email templates with sample data
docker-compose up        # full containerized local stack
```

Test commands and lint/typecheck commands will be added when the package.json files are scaffolded.

## Repository layout (planned)

The intended layout is in Section 12 of the spec. Top-level shape:

```
hr-agent-demo/
├── master-data/        # JSON config: roles, software-matrix, training, teams, etc.
├── seed-data/          # Pre-loaded candidates (Aanya, Vikram, Priya, Karan)
├── packages/
│   ├── portal/         # Next.js 15 App Router app
│   ├── orchestrator/   # Node + Fastify + multi-agent supervisor
│   └── shared/         # TypeScript types + Zod schemas
├── deploy/             # docker-compose files (deployment IaC is out of scope)
└── scripts/            # seed.ts, reset, rehearse, email-preview
```

Both `packages/portal` and `packages/orchestrator` will have their own `Dockerfile` (multi-stage builds).

## Configuration & branding

The demo is **company-agnostic**. All branding flows from environment variables:

```bash
COMPANY_NAME, COMPANY_DOMAIN, COMPANY_BRAND_COLOR,
COMPANY_LOGO_URL, COMPANY_OFFICE_CITY, COMPANY_OFFICE_ADDRESS
```

A shared `lib/company.ts` in both packages exposes `getCompany()`. These values are threaded through:
- Portal header & login screen
- Voice agent system prompt
- All 5 MJML email templates
- Office-location lookup for Tavily accommodation search

Change the env, rebuild, demo runs as a different company. No code edits needed.

## Important non-obvious decisions

- **Hybrid orchestration**: LLM is used for *creative configuration* (planning the desired state, diffing amendments) but *deterministic code* runs the dispatcher. This is deliberate for stage reliability — pure-LLM orchestration was rejected because of latency and hallucination risk.
- **Single pub/sub channel** (`agent:events`) with client-side filtering, not per-system channels. Simpler debugging.
- **Email templates use MJML** (not raw HTML) for responsive emails without table-soup. Templates live in `packages/orchestrator/src/email/templates/`.
- **Auth is intentionally fake** (plaintext env users, signed cookie). The README must warn against deploying as-is.
- **Demo runs locally** even though it's containerized. Deployment to ACA is the user's responsibility.

## When implementing

- Use the `frontend-design`, `tailwind-design-system`, and `ui-ux-pro-max` skills for the portal UI — the spec commits to state-of-art design quality, not generic AI aesthetic.
- Use the `claude-api` skill for Azure OpenAI SDK integration patterns.
- Use the `webapp-testing` skill for end-to-end Playwright tests of the cascade.
- Reliability mitigations (Section 11 of the spec) are **not optional** — every wow moment has a documented failure mode and mitigation that must be implemented.
