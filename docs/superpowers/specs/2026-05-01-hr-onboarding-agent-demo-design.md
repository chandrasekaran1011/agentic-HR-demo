# HR Onboarding Agent — Townhall Demo: Design Spec

**Date:** 2026-05-01
**Status:** Draft for review
**Audience target:** 3000+ org townhall
**Demo runtime target:** ~2:15 minutes

---

## 1. Goal & guiding outcome

Build a multi-agent HR Onboarding Agent demo that compresses a week of onboarding back-office work into ~60–90 seconds of stage time. The intent is **autonomy theatre**: the audience should walk out believing AI can absorb large amounts of boring back-office work and freeing humans for higher-value tasks.

The demo is triggered by an **HR person** (not the new joiner) one week before the joining date. A single voice/chat command produces a visible cascade of system updates, emails, and decisions across ~12 mock systems.

**This is a demo, not a production HRIS.** The mock systems are deliberately mocks. The application is fully containerized via Docker and `docker-compose` so it can be deployed wherever the user chooses. On the day of the townhall it runs locally on the presenter's laptop for stage reliability.

---

## 2. Demo arc (stage script)

Total runtime ≈ 2:15. Three acts plus closing.

### Pre-demo
Login screen visible. Presenter types `hr` / `acme2026`. Cookie set, redirects to `/candidates`.

### Act 1 — Status lookup (≈ 30s) — establishes credibility

```
T+0:05  HR (voice): "What's the status of onboarding for Priya Sharma?"
T+0:08  Voice agent calls lookup_status("Priya Sharma"). Priya's row pulses.
T+0:11  Agent (voice): "Priya Sharma is in progress. Eight of twelve actions
        complete. Her IT laptop was dispatched yesterday. Training enrollment
        and welcome notifications are still pending."
T+0:22  HR clicks Priya's row → /candidates/priya-sharma. Hero page is real.
T+0:28  HR clicks back to /candidates.
```

### Act 2 — The cascade (≈ 1:10) — autonomy theatre

```
T+0:35  HR (voice): "Now please onboard a new joiner — Arjun Mehta, Senior
        Backend Engineer, joining May 8th, AI Platform team."
T+0:42  Agent (voice): "Got it. Starting onboarding for Arjun Mehta. This
        is normally a week of work. I'll narrate as I go."
T+0:45  Voice agent calls start_onboarding(...). New row appears in the
        candidates table. HR clicks the new row → /candidates/arjun-mehta.
T+0:48  HERO PAGE LIVE. Stopwatch starts. 12 gray tiles.
T+0:50  ━━━ CASCADE BEGINS ━━━

        WAVE 1 (solo)         HRMS                       (creates emp_id)
        WAVE 2 (9 parallel)   Documents, Buddy, IT,
                              Software, Training,
                              ID Card, Payroll,
                              Seating, Parking
        WAVE 3 (2 final)      Manager Notify, Welcome    (Welcome sends real email)

T+1:15  Real welcome email arrives in presenter's inbox preview (W3)
T+1:30  All 12 tiles green. Stopwatch frozen at ~00:53.
        Savings counter: "6h 12m saved"
        Voice: "Onboarding setup for Arjun Mehta is complete. Twelve
                actions in fifty-three seconds."
```

### Act 3 — The mic-drop correction (≈ 25s) — proves the agent reasons

```
T+1:38  HR (voice): "Actually, sorry — Arjun is joining AI Infrastructure,
        not AI Platform."
T+1:42  Agent (voice): "No problem, updating now."
T+1:45  Affected tiles flip emerald → amber with "amending" overlay:
          Buddy, Software, Manager Notify, Seating
T+1:48  Reasoning panel shows the diff explicitly.
T+1:55  All four tiles back to emerald. Voice: "Done. Four actions updated.
        New buddy Meera Krishnan has been notified."
```

### Act 4 — Closing (≈ 15s)

```
T+2:00  HR clicks /admin. Big numbers reveal: 1 onboarding · 53s ·
        baseline 6h 12m · 16 audit events · 0 errors.
T+2:08  Agent (voice): "Anything else?"
T+2:10  HR (voice): "Thank you."
T+2:12  Agent (voice): "My pleasure."
        ━━━ END ━━━
```

---

## 3. Wow moments (committed)

| ID | Name | What the audience sees |
|----|------|------------------------|
| **W1** | Constellation light-up | 12 tiles flip pending → amber → emerald in waves |
| **W2** | Reasoning stream | Agent narrates decisions as they happen ("Buddy match: Rohan, 3yr tenure") |
| **W3** | Real email lands live | Actual ACS email arrives in presenter's inbox preview during demo |
| **W4** | Stopwatch + savings counter | ⏱ 00:53 / 💰 6h 12m saved — large, visible from back of hall |
| **W5** | Live correction | "Actually AI Infrastructure" → tiles re-amend in 8s, proves reasoning |
| **W9** | Voice round-trip closing | "Anything else?" / "Thank you" / "My pleasure" |

Plus: voice agent narrates progress mid-cascade ("Now provisioning IT, software, and training in parallel") — the orchestrator emits 5–6 curated narration cues.

Each wow has explicit reliability mitigations (Section 11).

---

## 4. System architecture

### Three running processes

| Process | Port | Stack | Responsibility |
|---|---|---|---|
| `portal` | 3000 | Next.js 15 (App Router) + Tailwind + shadcn/ui + Framer Motion | UI, thin API, SSE, ephemeral key minting |
| `orchestrator` | 3001 | Node + Fastify + Azure OpenAI SDK | Multi-agent supervisor, sub-agents, sends emails |
| `redis` | 6379 | Redis 7 | Source of truth, audit trail, pub/sub bus |

### Data flow during the demo

```
Browser ──────────────────────▶ Azure OpenAI Realtime API
  │     WebRTC (direct)
  │
  │ ephemeral key from
  │ /api/voice/token
  │
  ▼
Portal (Next.js)                          Orchestrator (Fastify)
  ├─ /api/events  (SSE)  ◀───────────────  publishes to agent:events
  ├─ /api/candidates                       │
  ├─ /api/systems/*                        │
  └─ /login, middleware                    │
       │                                   │
       └────── HTTP ──────────────────────▶│  POST /run, /amend, /lookup
                                           │
                                           ▼
                                ┌─────────────────────────┐
                                │  Redis                  │
                                │  Hashes, Lists, Pub/Sub │
                                └─────────────────────────┘
```

### Why three processes (not one)

- Realtime API expects WebRTC from browser, not server-to-server
- Cascading sub-agents on a hot 60-second burst should not backpressure UI rendering
- Each process is small (~200–500 LOC) and can run on the same laptop locally

---

## 5. Multi-agent architecture

### Voice agent (Azure OpenAI Realtime API, in browser via WebRTC)

Three tools only:
- `lookup_status(name)` — for status questions
- `start_onboarding(name, role, team, joining_date, email?)` — kick off cascade
- `amend_onboarding(name_or_id, changes)` — modify in-flight or just-completed onboarding

Style: warm, brief, professional. Confirms key details before calling `start_onboarding`. Never claims a tool succeeded before its result returns.

### Narration cues (server → voice)

The orchestrator publishes 5–6 curated `narration.cue` events to Redis pub/sub during a cascade. The portal's SSE forwards them to the browser, which injects them into the active Realtime session — most likely via a synthetic `conversation.item.create` (role assistant or user, content "Say: <cue>") followed by `response.create()`. The exact shape will be confirmed against the current Azure Realtime API spec during implementation; the contract from the orchestrator's side is a `narration.cue` event with a verbatim text string.

This decouples voice from orchestration: the voice model never knows about the 12 tools, it just speaks what it's told.

### Onboarding Supervisor (orchestrator's master agent)

Pattern: **desired-state execution**.

```
runOnboarding(candidate):
  1. PLAN          — LLM call computes desired state (12 sub-configs)
  2. EXECUTE       — dispatch sub-agents in 3 waves
  3. NARRATE       — emit 5–6 timed narration cues
  4. (later) AMEND — diff old vs new desired state, re-dispatch affected
```

Sub-agents are idempotent — re-running an agent reconciles its system to the new desired state.

### Sub-agents (12 specialists)

Each is a function-calling LLM run with a focused system prompt, domain tools, and a common toolbelt. Wave assignments:

| Wave | Sub-agents | Reason |
|---|---|---|
| 1 (solo) | HRMS | Generates `emp_id` that other agents reference |
| 2 (9 parallel) | Documents, Buddy, IT, Software, Training, ID Card, Payroll, Seating, Parking | Independent of each other |
| 3 (2 final) | Manager Notify, Welcome | Reference artifacts from prior waves |

### Common toolbelt (every sub-agent has these)

| Tool | Purpose |
|---|---|
| `lookup_role(role_name)` | Role metadata; soft-matches if exact missing |
| `lookup_software_for(role, team)` | Entitlements from master matrix |
| `lookup_courses_for(role, team)` | Required + recommended courses |
| `lookup_laptop_for(role, level)` | Laptop config |
| `lookup_documents_for(country, role_type)` | Doc checklist |
| `lookup_team(team_name)` | Floor, manager, buddy candidates, parking eligibility |
| `lookup_salary_band(role, level)` | Salary band |
| `get_current_time(timezone?)` | ISO timestamp now |
| `compute_date(base, offset_days)` | Date math |
| `format_date(iso, format)` | Human formatting |
| `lookup_candidate(id)` | Read candidate hash |
| `read_audit(candidate_id, n?)` | Read recent audit events |
| `read_tile_states(candidate_id)` | Read all 12 tile states |

A **base middleware** wraps every sub-agent to handle plumbing automatically:
- emits `tile.update status=in_progress` on entry
- emits `tile.update status=done` (or `error`) on exit
- appends an audit entry with the agent's reasoning summary
- publishes to `agent:events` pub/sub channel

### Domain tools (per agent)

| # | Sub-agent | Domain tools |
|---|---|---|
| 1 | HRMS | `assign_emp_id`, `lookup_dept_code`, `create_hrms_record` |
| 2 | Document | `lookup_required_docs`, `send_doc_checklist`, `track_checklist`, `send_email_via_acs` |
| 3 | Buddy | `list_team_members`, `score_buddy_fit`, `assign_buddy`, `send_email_via_acs` |
| 4 | IT | `check_inventory`, `raise_it_ticket` |
| 5 | Software | `request_license`, `entitle_software` |
| 6 | Training | `check_prerequisites`, `enroll_in_course` |
| 7 | ID Card | `request_id_card`, `schedule_photo_session` |
| 8 | Payroll | `setup_payroll`, `request_bank_details` |
| 9 | Seating | `find_available_desk`, `allocate_seat` |
| 10 | Parking | `check_parking_availability`, `allocate_slot` |
| 11 | Manager Notify | `lookup_manager_contact`, `send_email_via_acs` |
| 12 | Welcome | `compose_welcome_email`, `send_email_via_acs`, `tavily_search` |

`send_email_via_acs` is a shared helper (not in the common toolbelt because it's a side-effect tool, not a read tool) — exposed only to agents that need to send mail. Implementation lives in `packages/orchestrator/src/email/acs-client.ts`.

### Tavily — scoped to Welcome agent only

Tavily web search is **only** in the Welcome agent's toolbelt. Used when the candidate is relocating (`current_city != office_city`) to enrich the welcome email with accommodation suggestions. Audience sees the suggestions inside the email body, not as a separate tile.

If Tavily fails or is slow on the day, the Welcome email falls back to a standard non-relocation template. Cascade unaffected.

---

## 6. Data model (Redis)

### Key namespaces

```
candidate:{id}                  HASH    one per employee
audit:{candidate_id}            LIST    chronological audit trail (RPUSH)
tile:{candidate_id}:{system}    HASH    per-tile state
ticket:{system}:{id}            HASH    per-system record
system:{name}:tickets           LIST    ticket IDs for a system page
candidates:active               SET     all active candidate IDs
candidates:by_joining           ZSET    sorted by joining_date for table view
metrics:global                  HASH    admin dashboard counters
agent:run:{run_id}              HASH    orchestrator run metadata
desired:{candidate_id}          STRING  JSON of current desired state
master:roles                    HASH    role metadata
master:software                 HASH    software catalog
master:matrix:software          HASH    role × software entitlement matrix
master:matrix:training          HASH    role × training matrix
master:teams                    HASH    team metadata (floor, manager, buddies)
master:laptops                  HASH    role/level → laptop spec
master:salary                   HASH    role/level → band
master:documents                HASH    country/role → doc checklist
agent:events                    PUBSUB  single channel for live events
```

### Pub/sub event envelope (single channel)

```json
{
  "type": "tile.update" | "audit.append" | "narration.cue"
        | "candidate.create" | "candidate.update" | "metrics.update"
        | "cascade.complete" | "cascade.amend.start" | "email.sent",
  "candidate_id": "arjun-mehta",
  "system": "buddy",
  "payload": { "status": "done", "artifact_summary": "Rohan Desai (3yr, BE)" },
  "timestamp": "2026-05-01T10:24:04.123Z",
  "run_id": "run-2026-05-01-1023"
}
```

Filtering happens client-side — fewer subscribers, easier to debug, sufficient at our event volume (~20 events per cascade).

### Master data sources

Loaded from JSON files in `master-data/` into Redis at server boot. Reset script reseeds them. Master data is part of the application contract — versioned in git.

| Master | Redis key | Consumed by |
|---|---|---|
| Roles & levels | `master:roles` | All agents |
| Software catalog | `master:software` | Software agent |
| Role × Software matrix | `master:matrix:software` | Software agent |
| Training catalog & matrix | `master:matrix:training` | Training agent |
| Laptop configs | `master:laptops` | IT agent |
| Document checklists | `master:documents` | Document agent |
| Teams | `master:teams` | Buddy, Manager, Seating, Parking |
| Salary bands | `master:salary` | Payroll agent |

### Seed candidates

Loaded into Redis at boot (with full audit trails + ticket records for credibility):

| Name | Role | Joining | Status | Progress |
|------|------|---------|--------|----------|
| Aanya Patel | Sr. Designer | 2026-04-15 (joined) | Active | 12/12 |
| Vikram Iyer | DevOps Engineer | 2026-04-22 (joined) | Active | 12/12 |
| **Priya Sharma** | PM, Data | 2026-05-05 | **In progress** | **8/12** |
| Karan Shah | Frontend Engineer | 2026-05-12 | Pending | 0/12 |

Demo run creates a 5th candidate (Arjun Mehta).

---

## 7. UI design

**Visual language:** dark theme (slate-950 base), shadcn/ui components, Tailwind, Framer Motion for all animations. State-of-art design via the `frontend-design`, `tailwind-design-system`, and `ui-ux-pro-max` skills during implementation.

**Status colors:** slate (pending) / amber (in-progress, amending) / emerald (done) / rose (error).

**Type sizing for projector:** stopwatch 96–112px, big-number cards 80px, tile names 32px, body 18px.

### Login page (`/login`)

Centered card on radial brand-color gradient. Logo and company name from `COMPANY_*` env vars. Username / password / Sign in. Wrong creds: shake animation + inline error.

### Persistent left sidebar (across all post-login routes)

Width: 30% of viewport (~576px on 1920px projector).

```
[Company logo + name]                  ← from env
HR Onboarding Agent  ● online          ← header + status pill

[Transcript: HR turns right-aligned, agent left-aligned]

[Tool call cards (collapsed by default; debug toggle expands)]

──────────────────────────────────────
        🎙  [waveform when active]
        Listening… / Speaking… / Idle
[mute] [restart] [debug] [logout]      ← user pill: "HR User · logout"
```

Mic ring states: slate (idle) / cyan (listening, pulsing) / amber (thinking, dots) / emerald (speaking, audio bars) / violet (tool call active).

### Main content routes

| Route | Purpose | Demo role |
|-------|---------|-----------|
| `/login` | Login form | Pre-demo |
| `/candidates` | Datatable: name, role, team, joining, status, progress | Demo entry point |
| `/candidates/:id` | **HERO** page: profile header, stopwatch+savings, 4×3 tile grid (W1), reasoning stream (W2), audit trail | Demo centerpiece |
| `/systems/{name}` | One CRUD page per system (12 of them) — list + detail (drawer) + minimal Add modal | Background credibility |
| `/admin` | Metrics dashboard: 4 big-number cards, time saved bar, active onboardings, recent activity feed | Closing reveal |
| `/admin/master-data/*` | Roles, software-catalog, role-software-matrix, training-matrix, teams, laptops, salary-bands, documents | Pre-demo or post-demo Q&A |

The **inbox preview** for W3 lives as a small fixed-position overlay rendered in the root `app/layout.tsx` only when `DEMO_MODE=true`. It polls the configured presenter mailbox every 5 seconds and animates a toast when a new message arrives. Persistent across all post-login routes so the W3 moment fires regardless of which page the presenter is on.

### Hero page layout (`/candidates/:id`)

```
┌────────────────────────────────────────────────────────────────┐
│ ◀ Back        [profile header: avatar, name, role/team/manager,│
│                joining date, status pill]                      │
│                                                  ⏱ 00:12        │
│                                                  💰 0h 38m saved│
├────────────────────────────────────────────────────────────────┤
│ 4×3 tile grid (12 tiles)                                       │
│ Each tile: icon, system name, status badge, artifact summary,  │
│ "view →" link                                                  │
│ Tile click → /systems/{name}/{ticket_id}                       │
├────────────────────────────────────────────────────────────────┤
│ Reasoning stream (latest 5, oldest fade)                       │
├────────────────────────────────────────────────────────────────┤
│ Audit trail (collapsed list, expand for full event JSON)       │
│ Newest at top, auto-scrolls as events arrive                   │
└────────────────────────────────────────────────────────────────┘
```

### CRUD scope per system page (scaledown agreed)

- **R**ead: list + detail (drawer) — full
- **U**pdate: status changes from agent (Redis-driven) + edit toggle in drawer — full
- **C**reate: minimal Add button → modal form per system
- **D**elete: skipped

### Master Data UI (admin)

Matrix screens (Role × Software primary; Role × Training similar). Click a cell → toggle entitlement, persists to Redis immediately. Add row (new role) / add column (new software) buttons.

```
                       M365  Slack  Copilot  Datadog  Jira  Tableau
Sr Backend Engineer     ✓     ✓      ✓        ✓       ✓
Jr Backend Engineer     ✓     ✓      ✓                ✓
PM, Data                ✓     ✓                       ✓       ✓
Designer                ✓     ✓
...
```

---

## 8. Email design (5 templates)

All templates: **MJML** → responsive HTML + plain-text fallback. Brand color, logo, sender derived from `COMPANY_*` env vars. Tokens via Handlebars-style placeholders (`{{candidate.name}}`, `{{company.name}}`).

A small `/admin/email-preview` page renders any template with sample data — useful for rehearsal.

| # | Template | Subject | Sent by | Recipient |
|---|----------|---------|---------|-----------|
| 1 | **Welcome Email** ★ | "Welcome to {{company.name}} — your first day at {{team}}" | Welcome agent | Candidate |
| 2 | Manager Notification | "New joiner: {{candidate.name}} — {{role}} — joining {{date}}" | Manager Notify agent | Manager |
| 3 | Buddy Intro | "You're {{candidate.name}}'s onboarding buddy" | Buddy agent (cc candidate) | Buddy |
| 4 | Document Checklist | "Action required: documents for your onboarding" | Document agent | Candidate |
| 5 | Admin Confirmation | "Onboarding initiated for {{candidate.name}}" | Supervisor | HR mailbox |

The Welcome Email (W3 hero) includes:
- Personalized greeting
- First day logistics
- Buddy details (name, photo, contact)
- Manager details
- Software & tools list
- Training plan with dates
- Documents needed (with deadline)
- **If relocating**: "Pre-arrival accommodation suggestions" — 3 hotel cards from Tavily output (name, distance, ₹/night, link)
- Calendar invite (`.ics` attachment)

Sending: **Azure Communication Services Email**, single SDK call per send.

---

## 9. Authentication

Demo-grade only. Username + password. Hardcoded users via env. Cookie-based session.

```bash
AUTH_USERS='[
  {"username":"hr",    "password":"acme2026", "name":"HR User"},
  {"username":"admin", "password":"acme2026", "name":"Admin"}
]'
AUTH_SESSION_SECRET=<random-32-bytes>
```

**Single role.** Both seed users have identical permissions — they can see and use everything (talk to agent, view candidates, view systems, edit master data). Two users exist only so the login screen has plausibility after a reset.

| Piece | Implementation |
|---|---|
| Middleware | `portal/middleware.ts` allows `/login`, `/api/auth/*`, `/_next/*`; redirects everything else to `/login` if no valid cookie |
| Login route | `/api/auth/login` validates, sets HMAC-signed HTTPOnly cookie `hr_session`, 8-hour TTL |
| Logout route | `/api/auth/logout` clears cookie |
| Session reader | `lib/auth.ts` exposes `getCurrentUser()` (server) and `useCurrentUser()` (client) |

**Out of scope (deliberate):** bcrypt/Argon, CSRF tokens, password reset, account lockout, refresh tokens, SSO. README warns: *"This auth is for demo only. Do not deploy."*

---

## 10. Configuration & company branding

**Single env-var contract.** Change the env, rebuild, demo runs as a different company. All 5 email templates, voice agent system prompt, portal header, and logo come from these:

```bash
COMPANY_NAME="Acme Corp"
COMPANY_DOMAIN="acme.com"
COMPANY_BRAND_COLOR="#3b82f6"
COMPANY_LOGO_URL="https://.../logo.png"
COMPANY_OFFICE_CITY="Chennai"
COMPANY_OFFICE_ADDRESS="DLF IT Park, Chennai 600032"
```

A shared `lib/company.ts` module in both packages reads these, exposed as `getCompany()`.

Other env vars (Azure, Redis, auth) live in the `.env.example` shipped with the repo; the user manages production substitution.

---

## 11. Reliability & risk register

| # | Risk | Mitigation |
|---|------|------------|
| 1 | Realtime API latency on stage | Pre-warm session at portal boot; voice agent narration prevents dead air |
| 2 | ACS email delay > 30 sec | Buffer (trigger send 15s before visibility); voice covers ("on its way") |
| 3 | LLM hallucinates a non-existent tool | Strict tool schemas + Zod validation on outputs |
| 4 | Wifi drop during demo | Cache Tavily responses pre-demo; everything else local |
| 5 | Microphone picks up audience noise | Close-talking mic; PTT option |
| 6 | Demo crashes mid-cascade | F5 reloads cleanly; all state in Redis |
| 7 | Voice model stuck in loop | "Restart conversation" button always visible in chat sidebar |
| 8 | SSE drop mid-cascade | Auto-reconnect with last-event-id + reconcile via `/api/candidates/:id/tiles` on reconnect |
| 9 | Sub-agent stalls | 5-second hard timeout; falls open to default config |
| 10 | Realtime model misparses W5 amend | Voice agent confirms before commit; `dry_run_diff` returned for confirmation |
| 11 | Reasoning sentences too long | 100-character cap in sub-agent prompts |
| 12 | Tavily slow / errors | Welcome agent falls back to non-relocation template; only the Welcome tile affected |

### Demo-mode flags

```bash
DEMO_MODE=true        # enables 200–500ms artificial tile delays (audience-visible flips)
DEBUG_TOOL_CALLS=false # show tool calls inline in chat sidebar
```

A `npm run rehearse` script does a full dry-run with mocked LLM responses for offline rehearsal.

---

## 12. Repo structure (single workspace monorepo)

```
hr-agent-demo/
├── package.json (npm workspaces, root scripts)
├── README.md
├── .env.example
├── master-data/                       (versioned in git)
│   ├── roles.json
│   ├── software-catalog.json
│   ├── role-software-matrix.json
│   ├── training-matrix.json
│   ├── teams.json
│   ├── laptops.json
│   ├── salary-bands.json
│   └── documents.json
├── seed-data/
│   └── candidates.json
├── packages/
│   ├── portal/                        (Next.js 15 App Router)
│   │   ├── app/
│   │   │   ├── login/page.tsx
│   │   │   ├── layout.tsx                     ← persistent chat sidebar
│   │   │   ├── candidates/
│   │   │   │   ├── page.tsx                   ← datatable
│   │   │   │   └── [id]/page.tsx              ← HERO detail
│   │   │   ├── systems/[system]/page.tsx      ← CRUD template (×12)
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx                   ← metrics dashboard
│   │   │   │   ├── master-data/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [section]/page.tsx
│   │   │   │   └── email-preview/page.tsx
│   │   │   ├── api/
│   │   │   │   ├── auth/login/route.ts
│   │   │   │   ├── auth/logout/route.ts
│   │   │   │   ├── events/route.ts            ← SSE (subscribes to Redis)
│   │   │   │   ├── voice/token/route.ts       ← Realtime ephemeral key mint
│   │   │   │   ├── candidates/...
│   │   │   │   ├── systems/...
│   │   │   │   └── master-data/...
│   │   │   └── middleware.ts                  ← auth gate
│   │   ├── components/
│   │   │   ├── chat-sidebar/
│   │   │   ├── tile-grid/                     (W1 — Framer Motion)
│   │   │   ├── reasoning-stream/              (W2)
│   │   │   ├── stopwatch/                     (W4)
│   │   │   ├── inbox-preview/                 (W3)
│   │   │   ├── candidates-table/
│   │   │   └── ui/                            (shadcn)
│   │   ├── lib/
│   │   │   ├── redis.ts
│   │   │   ├── company.ts
│   │   │   ├── auth.ts
│   │   │   ├── realtime-client.ts             (WebRTC + cue injection)
│   │   │   └── sse-source.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── orchestrator/                  (Node + Fastify, port 3001)
│   │   ├── src/
│   │   │   ├── server.ts                      ← POST /run, /amend, /lookup
│   │   │   ├── supervisor/
│   │   │   │   ├── compute-desired-state.ts
│   │   │   │   ├── diff-state.ts
│   │   │   │   └── narration-cues.ts
│   │   │   ├── agents/
│   │   │   │   ├── base-agent.ts              ← audit/tile/event middleware
│   │   │   │   ├── hrms-agent.ts
│   │   │   │   ├── document-agent.ts
│   │   │   │   ├── buddy-agent.ts
│   │   │   │   ├── it-agent.ts
│   │   │   │   ├── software-agent.ts
│   │   │   │   ├── training-agent.ts
│   │   │   │   ├── welcome-agent.ts           ← uses tavily + ACS (W3)
│   │   │   │   ├── idcard-agent.ts
│   │   │   │   ├── payroll-agent.ts
│   │   │   │   ├── manager-notify-agent.ts
│   │   │   │   ├── seating-agent.ts
│   │   │   │   └── parking-agent.ts
│   │   │   ├── tools/
│   │   │   │   ├── master-data.ts
│   │   │   │   ├── time.ts
│   │   │   │   ├── tavily.ts
│   │   │   │   └── ticket-helpers.ts
│   │   │   ├── email/
│   │   │   │   ├── acs-client.ts
│   │   │   │   ├── render.ts                  ← MJML → HTML
│   │   │   │   └── templates/
│   │   │   │       ├── welcome.mjml
│   │   │   │       ├── manager-notify.mjml
│   │   │   │       ├── buddy-intro.mjml
│   │   │   │       ├── document-checklist.mjml
│   │   │   │       └── admin-confirmation.mjml
│   │   │   └── llm/azure-openai.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── shared/                        (TypeScript types)
│       ├── types.ts
│       ├── events.ts
│       └── master-data-schemas.ts             (Zod)
│
├── deploy/
│   ├── docker-compose.yml                     (full local stack)
│   └── docker-compose.dev.yml                 (just redis, for npm run dev)
│
└── scripts/
    ├── seed.ts                        (load master + seed data into Redis)
    ├── reset-demo.sh
    ├── email-preview.ts
    └── rehearse.ts                    (dry-run with mock LLM)
```

---

## 13. Local development & demo prep

### Process startup (local)

```bash
# Single command from repo root:
npm run dev
# → docker-compose.dev.yml brings up redis
# → orchestrator on :3001 (hot reload)
# → portal on :3000 (hot reload)
# → opens http://localhost:3000 in chrome
```

Or full containerized: `docker-compose up` (uses the same Dockerfiles the user will deploy with).

### Demo prep checklist

```
PRE-FLIGHT (day before)
  □ npm run reset                    flushes + reseeds master + candidates
  □ npm run preview-email            verifies 5 templates render
  □ npm run rehearse                 full dry-run with mocked LLM
  □ Test Realtime API (one round-trip)
  □ Test ACS — send a real email to presenter inbox
  □ Pre-warm Tavily — query the accommodation search once,
    cache in Redis (key tavily:cache:<hash>)

DAY-OF (T-30 minutes)
  □ npm run reset
  □ Connect to projector, browser fullscreen on /login
  □ Inbox preview window opened in corner of screen
  □ Charge laptop, plug in close-talking mic
  □ Disable all OS notifications except inbox toast
  □ Test mic with one practice query
  □ Reset again so the test doesn't pollute the demo
```

---

## 14. Containerization (deployment is out of scope)

The application is fully containerized so it can run anywhere. **Cloud deployment, IaC, CI/CD, and managed identity are explicitly handled outside this project** — the user will take care of those. The deliverables we own here are:

- `packages/portal/Dockerfile` — multi-stage Next.js standalone build
- `packages/orchestrator/Dockerfile` — multi-stage Node build that bundles `master-data/*.json` and `seed-data/*.json` into the image
- `deploy/docker-compose.yml` — full local stack (redis + portal + orchestrator)
- `deploy/docker-compose.dev.yml` — just redis (for `npm run dev` with hot reload)

### Local container run

```bash
docker-compose -f deploy/docker-compose.yml up
# → redis on 6379, orchestrator on 3001, portal on 3000
```

### Network expectations

- Portal exposes 3000 to host
- Orchestrator exposes 3001 to host
- Browser → Azure OpenAI Realtime is **direct over WebRTC** regardless of where the portal runs; portal only mints ephemeral keys
- Redis password and Azure secrets flow in via `.env` for compose; the user is responsible for substituting Key Vault / managed identity equivalents at deploy time

---

## 15. Out of scope (deliberate)

- Real auth / user accounts beyond demo-grade
- Multi-tenant support (single COMPANY_NAME per deployment)
- Mobile responsive (projector is the only target)
- Internationalization
- Real ATS / HRIS integration (mock systems by design)
- Real payroll / bank API integration
- Real Teams / Slack integration (manager notify uses ACS Email)
- Production-grade error monitoring (console.error sufficient)
- Delete operations on system pages
- Confetti / heavy animations (read cheap on projector)

---

## 16. Implementation skill commitments

During implementation, these skills will be invoked:

- **`frontend-design`** + **`tailwind-design-system`** + **`ui-ux-pro-max:ui-ux-pro-max`** — for state-of-art UI quality (committed: not generic AI aesthetic)
- **`claude-api`** — for Azure OpenAI SDK usage in voice agent + sub-agents
- **`webapp-testing`** — for end-to-end Playwright tests of the cascade
- **`nodejs-backend-patterns`** — for the Fastify orchestrator service
- **`supabase-postgres-best-practices`** — not applicable (no Postgres in this design; mentioned only to confirm the DB choice was deliberate)

---

## 17. Decisions made (canonical reference)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Demo outcome | Autonomy theatre — "AI replaces boring back-office work" |
| 2 | Trigger persona | HR person, week before joining |
| 3 | Demo arc | Split-pane (chat + portal) |
| 4 | Timeline simulation | Real-time cascade (no day-clock) |
| 5 | Voice provider | Azure OpenAI Realtime API (browser WebRTC) |
| 6 | Persistence | Redis (hashes + lists + pub/sub + ZSET) |
| 7 | Email provider | Azure Communication Services |
| 8 | Wow moments | W1 + W2 + W3 + W4 + W5 + W9, plus voice narration during cascade |
| 9 | Demo view layout | Option A: 30/70 split, 4×3 tile grid |
| 10 | Portal navigation | Persistent left chat sidebar + route-based main content |
| 11 | CRUD scope | Full Read+Update, minimal Create, no Delete |
| 12 | Orchestrator language | Node (TypeScript across the stack) |
| 13 | Agent architecture | Two-tier — Realtime voice + multi-agent orchestrator |
| 14 | Sub-agent count | 12 specialists + 1 supervisor |
| 15 | Execution pattern | DAG with parallel waves (Wave 1: HRMS solo → Wave 2: 9 parallel → Wave 3: Manager+Welcome) |
| 16 | Master data | Internal Redis-backed; loaded from JSON files in `master-data/`; CRUD via admin matrix screens |
| 17 | Tavily scope | Welcome agent only, for relocation accommodation suggestions |
| 18 | Auth | Demo-grade single-role, plaintext env users, signed cookie |
| 19 | Branding | Env-var driven (`COMPANY_*`), surfaces everywhere |
| 20 | Stage demo location | Laptop locally |
| 21 | Deployment | Out of scope for this project — user handles cloud deploy, IaC, CI/CD, managed identity, and managed Redis separately |
| 22 | Containerization | Dockerfiles (portal, orchestrator) + docker-compose.yml for local |
| 23 | UI stack | Next.js 15 + Tailwind + shadcn/ui + Framer Motion (state-of-art) |
| 24 | Email templating | MJML → responsive HTML |
