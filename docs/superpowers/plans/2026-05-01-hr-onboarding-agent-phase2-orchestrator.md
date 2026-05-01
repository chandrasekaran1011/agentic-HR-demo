# HR Onboarding Agent — Phase 2: Orchestrator, Agents, Cascade

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans or superpowers:subagent-driven-development. Steps use checkbox `- [ ]` syntax.

**Goal:** Stand up the orchestrator service, build the supervisor + 12 sub-agents, wire up SSE so the portal animates the cascade live, send emails via Azure ACS. End state: HTTP-trigger an onboarding cascade and watch tiles flip green in the browser. **No voice yet — Phase 3.**

**Architecture:** Adds a second Node process (Fastify on :3001) that runs an LLM-driven supervisor and 12 sub-agents. Sub-agents share a base middleware that emits tile/audit/event side effects to Redis. Portal subscribes to `agent:events` pub/sub via SSE and updates UI in real time.

**Tech stack:** Node + Fastify + OpenAI SDK (Azure-flavored) + ioredis + MJML + Azure Communication Services Email SDK.

**Phase context:** Phase 2 of 4. Phase 1 shipped foundation + portal. Phase 3 adds voice. Phase 4 adds polish.

**Reference spec:** [../specs/2026-05-01-hr-onboarding-agent-demo-design.md](../specs/2026-05-01-hr-onboarding-agent-demo-design.md)

---

## File structure produced by Phase 2

```
hr-agent-demo/
├── packages/orchestrator/                    NEW
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── src/
│       ├── server.ts                          POST /run /amend /lookup /health
│       ├── llm/
│       │   └── azure-openai.ts                Azure-flavored OpenAI SDK client
│       ├── lib/
│       │   ├── redis.ts                       singleton client + pub/sub
│       │   ├── company.ts                     mirrors portal's
│       │   └── events.ts                      publishAgentEvent()
│       ├── tools/
│       │   ├── master-data.ts                 lookup_role, lookup_software_for, ...
│       │   ├── time.ts                        get_current_time, compute_date
│       │   ├── tavily.ts                      web search (welcome agent only)
│       │   ├── audit.ts                       append_audit, update_tile
│       │   └── ticket-helpers.ts              generateTicketId, commitSystemAction
│       ├── email/
│       │   ├── acs-client.ts                  ACS Email SDK wrapper
│       │   ├── render.ts                      MJML → HTML
│       │   └── templates/
│       │       ├── welcome.mjml
│       │       ├── manager-notify.mjml
│       │       ├── buddy-intro.mjml
│       │       ├── document-checklist.mjml
│       │       └── admin-confirmation.mjml
│       ├── agents/
│       │   ├── base-agent.ts                  shared LLM-call wrapper + middleware
│       │   ├── hrms-agent.ts
│       │   ├── document-agent.ts
│       │   ├── buddy-agent.ts
│       │   ├── it-agent.ts
│       │   ├── software-agent.ts
│       │   ├── training-agent.ts
│       │   ├── welcome-agent.ts               (uses Tavily + ACS)
│       │   ├── idcard-agent.ts
│       │   ├── payroll-agent.ts
│       │   ├── manager-notify-agent.ts
│       │   ├── seating-agent.ts
│       │   └── parking-agent.ts
│       └── supervisor/
│           ├── compute-desired-state.ts
│           ├── diff-state.ts
│           └── run-cascade.ts                 orchestrates 3 waves + emits cues
├── packages/portal/
│   ├── app/api/events/route.ts                NEW — SSE endpoint subscribed to Redis
│   ├── app/api/run/route.ts                   NEW — proxy to orchestrator /run
│   ├── components/sse-client.tsx              NEW — useSseEvents() hook
│   ├── app/candidates/[id]/                   MODIFIED — live tile updates + reasoning stream + stopwatch
│   └── components/inbox-preview.tsx           NEW — W3 toast (DEMO_MODE only)
├── e2e/cascade.spec.ts                        NEW — drives a /run and asserts tiles flip
└── deploy/docker-compose.dev.yml              MODIFIED — add orchestrator
```

---

## Pre-flight

This phase depends on Azure OpenAI access. Add to `.env` (and `packages/portal/.env`, `packages/orchestrator/.env`):

```bash
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_GPT4O_DEPLOYMENT=<deployment-name>
AZURE_OPENAI_REALTIME_DEPLOYMENT=<deployment-name>     # used in Phase 3

AZURE_COMM_CONNECTION_STRING=endpoint=https://<...>.communication.azure.com/;accesskey=<...>
AZURE_COMM_SENDER_ADDRESS=DoNotReply@<resource>.azurecomm.net

TAVILY_API_KEY=<tavily-key>

ORCHESTRATOR_URL=http://localhost:3001
```

Phase 2 falls back to a **deterministic mock LLM** if `AZURE_OPENAI_API_KEY` is unset, so development can proceed without keys.

---

## Task 1: Orchestrator package scaffold

**Files:** `packages/orchestrator/package.json`, `tsconfig.json`, `src/server.ts` (stub), `Dockerfile`

- [ ] **Step 1:** create `packages/orchestrator/package.json`:

```json
{
  "name": "orchestrator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@azure/communication-email": "^1.0.0",
    "@hr-agent/shared": "*",
    "fastify": "^5.0.0",
    "ioredis": "^5.4.0",
    "mjml": "^4.15.0",
    "openai": "^4.68.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/mjml": "^4.7.0",
    "@types/node": "^22.7.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2:** `packages/orchestrator/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false,
    "paths": {
      "@hr-agent/shared": ["../shared/src/index.ts"],
      "@hr-agent/shared/*": ["../shared/src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3:** `packages/orchestrator/src/server.ts` (minimum): Fastify with `/health`.

```typescript
import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 4:** `packages/orchestrator/Dockerfile`:

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/orchestrator/package*.json ./packages/orchestrator/
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm --workspace=orchestrator run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/orchestrator/dist ./packages/orchestrator/dist
COPY --from=builder /app/packages/orchestrator/node_modules ./packages/orchestrator/node_modules
COPY --from=builder /app/packages/orchestrator/package.json ./packages/orchestrator/package.json
COPY --from=builder /app/master-data ./master-data
EXPOSE 3001
CMD ["node", "packages/orchestrator/dist/server.js"]
```

- [ ] **Step 5:** install + verify health.

```bash
npm install
npm --workspace=orchestrator run dev &
sleep 3 && curl -s http://localhost:3001/health
# → {"ok":true}
pkill -f "tsx watch"
```

- [ ] **Step 6:** commit `feat(orchestrator): scaffold Fastify service with /health`.

---

## Task 2: Redis client + pub/sub helpers (orchestrator)

**Files:** `packages/orchestrator/src/lib/redis.ts`, `events.ts`, `redis.test.ts`

- [ ] Create `redis.ts` (mirrors portal's pattern; singleton ioredis client + closeRedis).
- [ ] Create `events.ts`:

```typescript
import { getRedis } from "./redis.js";
import type { AgentEvent } from "@hr-agent/shared";

export async function publishAgentEvent(event: AgentEvent): Promise<void> {
  const r = getRedis();
  await r.publish("agent:events", JSON.stringify(event));
}
```

- [ ] Add a vitest that publishes one event and asserts a temp subscriber receives it.
- [ ] Commit.

---

## Task 3: Master-data lookup tools

**Files:** `packages/orchestrator/src/tools/master-data.ts` (+ test)

- [ ] Implement `lookup_role(roleName)`, `lookup_software_for(roleId, team)`, `lookup_courses_for(roleFamily, team)`, `lookup_laptop_for(roleFamily, level)`, `lookup_documents_for(country, roleType)`, `lookup_team(teamId)`, `lookup_salary_band(roleFamily, level)` — all reading from the `master:*` hashes seeded by Phase 1.
- [ ] Each function: takes args, returns parsed JSON value (or null), no side effects.
- [ ] Vitest: assert `lookup_software_for("sr_be")` returns `["m365", "slack", ...]`. Assumes seed already loaded.
- [ ] Commit.

---

## Task 4: Time tools

**Files:** `packages/orchestrator/src/tools/time.ts` (+ test)

- [ ] `get_current_time(): string` returns ISO timestamp.
- [ ] `compute_date(baseISO: string, offsetDays: number): string` returns ISO date.
- [ ] `format_date(iso: string, locale = "en-IN"): string`.
- [ ] Test all three.
- [ ] Commit.

---

## Task 5: Audit + tile + ticket helpers

**Files:** `packages/orchestrator/src/tools/ticket-helpers.ts`, `audit.ts` (+ tests)

- [ ] `generateTicketId(prefix: string): string` — uses date + counter (Redis INCR).
- [ ] `commitSystemAction(args)` — single helper that:
   1. writes ticket hash
   2. RPUSHes to `system:{name}:tickets`
   3. RPUSHes audit entry to `audit:{candidate_id}`
   4. updates tile state via HSET `tile:{candidate_id}:{system}`
   5. publishes `tile.update` event
- [ ] Tests: call `commitSystemAction` and assert all five Redis writes happened + event published.
- [ ] Commit.

---

## Task 6: Tavily wrapper (with cache)

**Files:** `packages/orchestrator/src/tools/tavily.ts` (+ test)

- [ ] `tavily_search(query, maxResults=5)` calls Tavily API, caches in Redis under `tavily:cache:<sha1(query)>` with 24h TTL.
- [ ] If `TAVILY_API_KEY` unset, returns `[]` and logs warning.
- [ ] Test: with mock fetch, asserts cache hit on second call.
- [ ] Commit.

---

## Task 7: Azure OpenAI client wrapper (with mock fallback)

**Files:** `packages/orchestrator/src/llm/azure-openai.ts` (+ test)

- [ ] Create a thin wrapper `chatComplete(opts: {messages, tools?, jsonSchema?})` returning OpenAI-shaped response.
- [ ] If `AZURE_OPENAI_API_KEY` is missing, returns deterministic mock responses based on `opts.messages[last].content`. Keys off `mock:` prefix in system prompt.
- [ ] Test: with API key unset, deterministic mock; with mocked OpenAI client, real path returns expected.
- [ ] Commit.

---

## Task 8: Base sub-agent middleware

**Files:** `packages/orchestrator/src/agents/base-agent.ts` (+ test)

- [ ] Define `BaseAgent` class:
   - `run(candidate, subconfig, runId)` flow:
     1. `commitSystemAction(... status=in_progress)` (tile flips amber)
     2. invoke LLM with focused system prompt + tools
     3. handle tool calls in a loop (max 5 iterations)
     4. on success, `commitSystemAction(... status=done, artifact_summary=<from LLM final message>)`
     5. on error/timeout, `commitSystemAction(... status=error, artifact_summary="failed")` + emit
   - 5-second hard timeout per agent.
   - Optional `DEMO_DELAY_MS` env (default 300) inserted before final tile-flip-to-green.
- [ ] Test with a mock agent and mock LLM response. Verify: in_progress emitted, done emitted, audit appended.
- [ ] Commit.

---

## Tasks 9–20: 12 sub-agents (one per task)

For each sub-agent below, create `packages/orchestrator/src/agents/<name>.ts` extending `BaseAgent` with:

- focused system prompt
- domain tools (function definitions per spec Section 5)
- final tile artifact_summary format

Order: hrms → documents → buddy → it → software → training → idcard → payroll → seating → parking → manager_notify → welcome.

For each:

- [ ] Create the agent file with system prompt + tools + LLM loop.
- [ ] Smoke test: call `agent.run(mockCandidate, mockConfig, "test-run")` against the mock LLM and assert tile becomes "done" with the expected artifact summary.
- [ ] Commit.

The Welcome agent (Task 20) additionally:
- pulls `lookup_team(team).manager_email` and renders `welcome.mjml`
- if `current_city !== COMPANY_OFFICE_CITY`, calls `tavily_search` and includes hotel cards in email body
- calls `acs-client.send`

---

## Task 21: Email — MJML render + ACS client

**Files:** `packages/orchestrator/src/email/render.ts`, `acs-client.ts`, `templates/*.mjml`

- [ ] Implement `renderTemplate(name, vars)` — reads `templates/<name>.mjml`, runs MJML, replaces `{{var}}` placeholders.
- [ ] Create the 5 MJML templates (welcome, manager-notify, buddy-intro, document-checklist, admin-confirmation) with brand color and company name pulled from env.
- [ ] Implement `sendEmail({to, subject, html, text?})` using `@azure/communication-email`. If `AZURE_COMM_CONNECTION_STRING` unset, log to stdout instead of sending and return `{messageId: "mock-..."}`.
- [ ] Test: `renderTemplate("welcome", sampleVars)` produces HTML that includes the candidate's name and company name.
- [ ] Commit.

---

## Task 22: Supervisor — compute desired state

**Files:** `packages/orchestrator/src/supervisor/compute-desired-state.ts` (+ test)

- [ ] Implement `computeDesiredState(candidate)` — calls LLM with planning prompt, validates JSON output via Zod schema (12 system sub-configs), returns plan or throws.
- [ ] Mock-LLM fallback returns a deterministic plan for any candidate.
- [ ] Test: against mock, asserts plan has all 12 systems.
- [ ] Commit.

---

## Task 23: Supervisor — diff state

**Files:** `packages/orchestrator/src/supervisor/diff-state.ts` (+ test)

- [ ] Given old + new desired state, return list of `affected_systems` based on heuristics (role change → software/training/manager_notify; team change → buddy/manager/seating/software).
- [ ] Pure function, no LLM (deterministic for stage reliability).
- [ ] Test: covers role-only, team-only, joining-date-only changes.
- [ ] Commit.

---

## Task 24: Supervisor — run cascade

**Files:** `packages/orchestrator/src/supervisor/run-cascade.ts` (+ test)

- [ ] `runOnboarding(candidate)`:
   1. compute desired state, persist to `desired:{id}`
   2. emit `candidate.create`
   3. WAVE 1: hrms (solo)
   4. WAVE 2: 9 sub-agents in parallel via `Promise.all`
   5. WAVE 3: manager_notify, welcome
   6. emit narration cues at fixed offsets (300ms after wave 1 start, mid-wave 2, mid-wave 3, end)
   7. emit `cascade.complete`
- [ ] `amendOnboarding(candidate, changes)`:
   1. read old desired state, compute new
   2. diff → affected systems
   3. emit `cascade.amend.start` for each affected tile (status amending)
   4. re-run affected sub-agents
- [ ] Test: full cascade with mock LLM + mock ACS, assert all 12 tiles end "done", `cascade.complete` emitted, audit has expected entries.
- [ ] Commit.

---

## Task 25: HTTP endpoints

**Files:** `packages/orchestrator/src/server.ts` (extend)

- [ ] `POST /run` body `{candidate}` — kicks off cascade fire-and-forget, returns `{run_id, candidate_id}`.
- [ ] `POST /amend` body `{name_or_id, changes}` — triggers amendment.
- [ ] `POST /lookup` body `{name_or_id}` — reads candidate + tiles, returns natural-language summary.
- [ ] All endpoints validate body via Zod.
- [ ] Smoke test with supertest: `POST /run` returns 200 with run_id, eventually leads to all tiles "done" in Redis.
- [ ] Commit.

---

## Task 26: Portal SSE endpoint

**Files:** `packages/portal/app/api/events/route.ts`, `packages/portal/lib/redis-pubsub.ts`

- [ ] Create dedicated Redis subscriber connection (separate from main client; ioredis subscribers can't issue regular commands).
- [ ] SSE handler: writes `data: <json>\n\n` for each `agent:events` message; handles client disconnect.
- [ ] Optional `?candidate_id=` filter — only forward events matching.
- [ ] Verify with `curl -N http://localhost:3000/api/events` while another client publishes.
- [ ] Commit.

---

## Task 27: Portal — useSseEvents hook + tile-grid live updates

**Files:** `packages/portal/components/use-sse-events.ts`, modify `packages/portal/app/candidates/[id]/tile-grid.tsx`

- [ ] Hook subscribes to `/api/events?candidate_id=<id>`, parses event JSON, exposes a callback per event type.
- [ ] Tile grid becomes a client component that:
   - takes initial server-rendered tiles
   - subscribes to SSE
   - on `tile.update`, updates that tile's status with Framer Motion variants (slate → amber → emerald)
- [ ] Manual verify: trigger `POST /api/run` for a candidate, watch tiles flip live.
- [ ] Commit.

---

## Task 28: Portal — reasoning stream component (W2)

**Files:** `packages/portal/components/reasoning-stream.tsx`, modify candidate detail page

- [ ] Subscribes to `audit.append` events for current candidate; renders latest 5 with fade-in animation.
- [ ] Place below tile grid on `/candidates/[id]`.
- [ ] Commit.

---

## Task 29: Portal — stopwatch + savings counter (W4)

**Files:** `packages/portal/components/stopwatch.tsx`

- [ ] Starts on first `tile.update` (in_progress) for the candidate; stops on `cascade.complete`.
- [ ] Savings counter: const baseline `6h 12m` minus elapsed seconds, animated.
- [ ] Place in profile header.
- [ ] Commit.

---

## Task 30: Portal — proxy /api/run

**Files:** `packages/portal/app/api/run/route.ts`

- [ ] POSTs to `${ORCHESTRATOR_URL}/run` with body, returns response.
- [ ] Add a temporary trigger button to `/candidates` table — for any "pending" candidate, button POSTs `/api/run`. (Phase 3 replaces this with voice.)
- [ ] Commit.

---

## Task 31: Portal — inbox preview component (W3, demo-mode only)

**Files:** `packages/portal/components/inbox-preview.tsx`, modify `app/layout.tsx`

- [ ] Fixed-position bottom-right card.
- [ ] Subscribes to `email.sent` SSE events; on event, slides in a toast for 8s with subject + recipient.
- [ ] Renders only when `process.env.DEMO_MODE === "true"`.
- [ ] Commit.

---

## Task 32: docker-compose adds orchestrator

**Files:** modify `deploy/docker-compose.dev.yml` and `deploy/docker-compose.yml`

- [ ] Add `orchestrator` service to dev compose so `npm run redis` brings up redis only (unchanged), but full `docker-compose up` brings up portal + orchestrator + redis.
- [ ] Update root `package.json` `dev` script to also start orchestrator.
- [ ] Commit.

---

## Task 33: e2e cascade smoke test

**Files:** `e2e/cascade.spec.ts`

- [ ] Test: login as hr, navigate to `/candidates`, click "Onboard" on Karan Shah (pending), wait for `cascade.complete` event (max 30s), assert all 12 tiles green on his detail page.
- [ ] Run; commit.

---

## Task 34: README updates

**Files:** modify `README.md`

- [ ] Document Phase 2 commands (`npm run dev` now also starts orchestrator).
- [ ] Document the `.env` additions (Azure OpenAI, ACS, Tavily).
- [ ] Note the mock-LLM fallback for offline dev.
- [ ] Commit + tag `phase-2-complete`.

---

## What Phase 3 will add

- Voice agent via Azure OpenAI Realtime API in browser
- WebRTC ephemeral key minting endpoint
- Voice tools (`lookup_status`, `start_onboarding`, `amend_onboarding`)
- Narration cue injection from server → browser → Realtime session
- Removes the temporary "Onboard" trigger button (replaced by voice)
- W5 mic-drop amend flow end-to-end
- W9 voice round-trip closing
