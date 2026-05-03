# HR.AI

An autonomous HR onboarding agent — one HR command, twelve back-office systems
provisioned in 60–90 seconds.

> Built as a townhall demo of "autonomy theatre": the audience watches a week
> of manual onboarding work compress into stage time. Speak (or type) one
> instruction — *"Onboard Tyler Brooks, Senior Frontend Engineer, AI Platform
> team, joining May 12"* — and watch HRMS, IT asset, software entitlements,
> training plan, ID card, payroll, seating, parking, buddy assignment,
> manager notification, document checklist, and welcome email all light up
> in parallel.

---

## What it does

A multi-agent system orchestrates twelve mock back-office workflows:

| Sub-agent       | What it does                                          |
| --------------- | ----------------------------------------------------- |
| HRMS            | Creates the employment record, mints `emp_id`        |
| Documents       | Sends the candidate the joining-document checklist   |
| Buddy           | Picks a buddy from the team's pool, sends intro mail |
| IT              | Allocates a laptop SKU + accessory bundle            |
| Software        | Provisions per-role software entitlements            |
| Training        | Enrolls in required + recommended courses            |
| ID Card         | Issues the access badge                              |
| Payroll         | Sets up the payroll record + salary band             |
| Manager Notify  | Emails the manager with the new joiner brief         |
| Seating         | Assigns a desk on the team's floor                   |
| Parking         | Allocates a parking slot if eligible                 |
| Welcome         | Sends a welcome email (with hotel suggestions if relocating, via Tavily) |

A **supervisor agent** computes the desired end-state, runs the sub-agents in
three parallel waves, and re-runs only the affected ones when an HR person
amends the request mid-cascade ("actually, change Tyler's team to AI
Infrastructure").

The user-facing surface is a single web portal:

- **Chat sidebar** (left) — text agent powered by Azure OpenAI
- **Voice mode** — full-duplex Realtime WebRTC, "Sara" the voice assistant
- **Right panel** — candidate cascade view, system queues (ServiceNow-style),
  admin dashboards, master-data editors

---

## Architecture

```
┌────────────────┐          ┌────────────────┐          ┌──────────────┐
│   Browser      │  HTTP    │  Portal :3000  │  HTTP    │ Orchestrator │
│   (Next.js)    │ ───────▶ │  (Next 15 RSC) │ ───────▶ │   :3001      │
│                │          │                │          │  (Fastify)   │
│                │  SSE     │                │ ◀──pubsub─┤              │
│                │ ◀────────┤  /api/events   │           │              │
└────────┬───────┘          └────────────────┘          └──────┬───────┘
         │                                                     │
         │  WebRTC                                             │
         ▼                                                     ▼
   Azure OpenAI                                       ┌──────────────┐
   Realtime API                                       │    Redis     │
   (voice)                                            │ source-of-   │
                                                      │ truth + bus  │
                                                      └──────────────┘
```

Three processes, all local for the demo:

| Process       | Port | Stack                                              |
| ------------- | ---- | -------------------------------------------------- |
| `portal`      | 3000 | Next.js 15 App Router, Tailwind, shadcn/ui, Framer Motion |
| `orchestrator`| 3001 | Node + Fastify + Azure OpenAI SDK + Azure Communication Services |
| `redis`       | 6379 | Redis 7 (Docker)                                   |

The portal is the only thing the browser talks to over HTTP. Voice goes
*directly* to Azure OpenAI Realtime via WebRTC after the portal mints an
ephemeral session token. Live cascade updates flow Redis → orchestrator →
portal → SSE → browser.

---

## Tech stack

- **Frontend** — Next.js 15 (App Router, RSC), TypeScript, Tailwind CSS,
  shadcn/ui, Framer Motion, lucide-react, EventSource (SSE), WebRTC
  (RTCPeerConnection + RTCDataChannel)
- **Backend** — Node 20, Fastify, Zod
- **AI** — Azure OpenAI (Responses API for chat, Realtime API for voice),
  function calling for tool use
- **Search** — Tavily (welcome agent only — for relocating-candidate hotel suggestions)
- **Email** — Azure Communication Services + MJML templates
- **State** — Redis 7 (hashes, sets, sorted sets, pub/sub)
- **Containers** — Docker, docker-compose (dev + prod profiles)
- **Tests** — Vitest (unit), Playwright (e2e)

---

## Quick start

```bash
# 1. Configure
cp .env.example .env
# edit .env — at minimum set Azure OpenAI keys + ACS keys, OR leave them blank
# to run in mock mode

# Next.js loads env from each package directory:
cp .env packages/portal/.env
cp .env packages/orchestrator/.env

# 2. Install
npm install

# 3. Start Redis (Docker)
npm run redis

# 4. Seed
npm run reset                      # FLUSHDB + load master data + 8 candidates

# 5. Run (two terminals)
npm run orchestrator               # tsx watch, port 3001
npm run portal                     # next dev,  port 3000
```

Open <http://localhost:3000> and log in as `hr` / `acme2026`.

### Try it

**Status lookup**
> "What's the status of Jessica Cohen?"

**Onboard a new joiner**
> "Onboard Tyler Brooks, Senior Frontend Engineer, AI Platform team, joining May 12"

→ confirmation → cascade fires → twelve tiles flip green in ~75s

**Mid-cascade correction**
> "Actually, change Tyler's team to AI Infrastructure"

→ supervisor diffs the desired-state, only affected sub-agents re-run.

**Per-tile self-service** (UI)

Click any tile on a candidate detail page — slide-in drawer lets you re-run
that specific step, re-send a notification, or reassign the buddy from the
team's pool.

**Voice**

Click the mic. Browser opens a WebRTC session to Azure OpenAI Realtime.
Speak the same kinds of requests — transcripts join the chat thread, voice
narrates the cascade as it runs.

---

## Mock mode (no Azure keys required)

Without cloud credentials the app is still fully usable for development:

| Component | Mock behavior                                                         |
| --------- | --------------------------------------------------------------------- |
| Chat      | Canned responses (no real reasoning) — UI flows still exercised       |
| Voice     | Mic shows "set keys to enable" message                                 |
| Email     | Logged to stdout, `email.sent` events still publish (toasts appear)   |
| Tavily    | Empty results — welcome email skips the hotel suggestion              |

The cascade, the SSE event bus, the master-data editors, and the system
queues all work without any Azure account.

---

## Environment variables

See [`.env.example`](.env.example) for the canonical list. Highlights:

| Variable                                           | Required for      | Notes                                                  |
| -------------------------------------------------- | ----------------- | ------------------------------------------------------ |
| `COMPANY_NAME`, `COMPANY_BRAND_COLOR`, `COMPANY_DOMAIN`, … | Branding   | Threaded into UI + every email template                |
| `AZURE_OPENAI_CHAT_*`                              | Text chat         | Endpoint, key, version, deployment for the chat model  |
| `AZURE_OPENAI_REALTIME_*`                          | Voice             | Often a *different* Azure resource (different region)  |
| `AZURE_COMM_CONNECTION_STRING`, `..._SENDER_ADDRESS` | Real email      | Mock fallback otherwise                                |
| `TAVILY_API_KEY`                                   | Hotel suggestions | Welcome agent enrichment                               |
| `DEMO_EMAIL_OVERRIDE`                              | Demo safety       | Routes ALL outbound mail to this address               |
| `DEMO_MODE`, `DEMO_DELAY_MS`                       | Stage feel        | Adds 200–500ms artificial per-tile delay (visible from row 50) |

After editing `.env`, copy it to `packages/portal/.env` and
`packages/orchestrator/.env`, then restart both — Next.js does not hot-reload
env vars.

---

## Repository layout

```
master-data/                  versioned config: roles, software matrix, teams, training, …
seed-data/candidates.json     8 demo candidates
packages/shared/              TypeScript types + Zod schemas
packages/portal/              Next.js 15 app (UI + thin API + SSE bridge)
  app/(app)/                  authenticated routes (route group)
    page.tsx                  landing
    candidates/               list + detail (cascade tiles)
    systems/[system]/         per-system queue page (12 routes)
    admin/                    dashboard + settings + master-data editors
  app/api/                    chat SSE proxy, voice token mint, tool exec
  components/chat-sidebar.tsx persistent chat thread (across nav)
  components/voice-agent.tsx  Realtime API + WebRTC hook
  components/cosmic-orb.tsx   Siri-style animated orb for voice mode
packages/orchestrator/        Fastify + supervisor + 12 sub-agents + email
  src/agent-tools/            6 tools shared by chat + voice
  src/supervisor/             compute-desired-state, diff-state, run-cascade
  src/agents/                 12 sub-agents (one per back-office system)
  src/email/                  MJML templates + ACS client
  src/llm/                    Azure OpenAI Responses + Realtime clients
scripts/seed.ts               loads master-data + seed-data into Redis
scripts/reset-demo.sh         flush + reseed
scripts/rehearse.ts           pre-flight: pings every Azure resource + e2e cascade
deploy/                       docker-compose dev + prod
e2e/                          Playwright tests
docs/DEMO-SCRIPT.md           presenter script for live runs
```

---

## Data model

Single source of truth is Redis. Key namespaces:

- `candidate:{id}` — candidate hash
- `tile:{candidate_id}:{system}` — per-tile state
- `ticket:{system}:{id}` — per-system mock record
- `audit:{candidate_id}` — chronological event list
- `desired:{candidate_id}` — JSON of the supervisor's desired-state plan
- `master:*` — master data loaded from `master-data/*.json` at boot
- `agent:events` — single pub/sub channel; UI subscribes, fans out via SSE

The portal subscribes once to `agent:events` and fans messages out via SSE to
the browser. Filtering happens client-side.

---

## Multi-agent dispatch

```
Wave 1 (solo):     HRMS                          → generates emp_id
Wave 2 (parallel): Documents, Buddy, IT, Software, Training,
                   ID Card, Payroll, Seating, Parking
Wave 3 (parallel): Manager Notify, Welcome      → reference prior artifacts
```

The supervisor is **deterministic code** — Wave 2 fires sub-agents in parallel
via `Promise.all`. The LLM is used for *creative configuration* (planning the
desired state, diffing amendments), not for orchestration itself. This is
deliberate for stage reliability: pure-LLM orchestration was rejected because
of latency and hallucination risk.

Sub-agents are **idempotent** — re-running reconciles to the new desired
state. That's why mid-cascade amendments work cleanly.

---

## Tests

```bash
npm test               # vitest — unit tests across all packages
npm run test:e2e       # playwright — 5 tests, ~11s
```

The e2e suite covers the cascade, chat, and three smoke tests. Real ACS
sends are skipped in CI (`DISABLE_ACS_SEND=true`).

---

## Demo-day checklist

```
T-30 minutes
  □ npm run reset                  flush + reseed
  □ npm run orchestrator           terminal 1 (port 3001)
  □ npm run portal                 terminal 2 (port 3000)
  □ npm run rehearse               pre-flight: pings every Azure resource +
                                   runs a real cascade end-to-end. Must pass.
  □ Browser fullscreen on /candidates
  □ Charge laptop, plug in close-talking mic
  □ Disable OS notifications except inbox toast
  □ Test voice mic: "What's the status of Jessica Cohen?"
  □ npm run reset                  fresh state for the live run

T-0
  Act 1 — status lookup (chat or voice):
    "What is the status of Jessica Cohen?"
  Act 2 — onboard new joiner:
    "Onboard Tyler Brooks, Senior Frontend Engineer,
     AI Platform team, joining May 12"
    → confirm details → cascade fires → 12 tiles flip green
  Act 3 — mic-drop correction:
    "Actually, Tyler is joining AI Infrastructure, not AI Platform"
    → affected tiles re-amend → re-flip green
  Act 4 — closing reveal:
    Click /admin → big-number reveals animate in
    Voice: "Anything else?" / "Thank you" / "My pleasure."

Recovery
  - F5 to reload — all state in Redis, no data loss
  - "Onboard manually" button on candidates table is a fallback path
  - Email override (admin/settings) routes all mail to a single address
```

See [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md) for the long form.

---

## Master-data admin UI

Visit `/admin/master-data` to edit the rules the agent uses:

- **Roles** — job titles, role family, level
- **Software catalog** — what we license org-wide
- **Role × Software matrix** ★ — checkbox grid; toggle a cell, the next cascade applies it
- **Training matrix** — required + recommended courses per role family
- **Teams** — floor, manager, buddy pool, parking eligibility

Changes are live — no rebuild, no restart.

---

## Branding (multi-tenant by env)

The demo is **company-agnostic**. All branding flows from environment
variables, surfaced via a shared `lib/company.ts`:

```bash
COMPANY_NAME, COMPANY_DOMAIN, COMPANY_BRAND_COLOR,
COMPANY_LOGO_URL, COMPANY_OFFICE_CITY, COMPANY_OFFICE_ADDRESS
```

These threads through:

- Portal header & login screen
- Voice agent system prompt
- All five MJML email templates
- Office-location lookup for the Tavily accommodation search

Change the env, rebuild, demo runs as a different company. No code edits.

---

## Auth

**Demo only — do not deploy as-is.**

Auth is intentionally minimal: plaintext users in env, signed cookie session.
There is no rate limiting, no CSRF, no password hashing. For production use,
swap in your real IdP (Azure AD, Okta, etc.) at the `/api/auth/*` boundary.

---

## Deployment

Dev is local. The codebase is fully containerized:

```bash
docker compose -f deploy/docker-compose.yml up --build
```

Both `packages/portal` and `packages/orchestrator` have their own multi-stage
`Dockerfile` (Node 20 alpine). Redis is the official `redis:7-alpine` image.

---

## Deploying to an Azure Ubuntu VM

There's a one-shot installer at [`deploy/install.sh`](deploy/install.sh)
that does everything below for you (Docker, Node, swap, .env, build, seed,
firewall, nginx, Let's Encrypt, systemd unit). The TL;DR is:

```bash
ssh azureuser@<vm-ip>
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/chandrasekaran1011/agentic-HR-demo.git hr-ai
cd hr-ai

# First run scaffolds .env from .env.example, then exits.
sudo bash deploy/install.sh hr-ai.example.com you@example.com

# Edit .env (Azure keys, ACS, COMPANY_*, AUTH_SESSION_SECRET) then re-run:
nano .env
sudo bash deploy/install.sh hr-ai.example.com you@example.com
```

The script is idempotent — safe to re-run after a `git pull`. Pass `_` as
the domain to skip nginx and expose the portal on port 3000 directly (handy
for IP-only smoke testing, but voice mode requires HTTPS so don't ship it
that way).

The rest of this section is the same flow done by hand.

### 1. Provision the VM

In the Azure portal (or `az` CLI):

- **Image:** Ubuntu Server 22.04 LTS (or 24.04 LTS)
- **Size:** `Standard_B2s` minimum (2 vCPU, 4 GB) — `Standard_B2ms` (8 GB) is more comfortable for the `next build` step
- **Disk:** 30 GB+ premium SSD
- **Networking — NSG inbound rules:**
  - 22 (SSH) — your IP only
  - 80 (HTTP) — `0.0.0.0/0` (Let's Encrypt challenge)
  - 443 (HTTPS) — `0.0.0.0/0`
- **DNS:** point an A record (e.g. `hr-ai.example.com`) to the VM's public IP

```bash
ssh azureuser@<vm-ip>
```

### 2. Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker  # or log out / back in
```

### 3. Clone the repo + configure

```bash
cd ~
git clone https://github.com/chandrasekaran1011/agentic-HR-demo.git hr-ai
cd hr-ai
cp .env.example .env
nano .env   # fill in real values — see table below
```

Minimum `.env` keys for a real deployment:

| Key                                                         | Why                          |
| ----------------------------------------------------------- | ---------------------------- |
| `COMPANY_NAME`, `COMPANY_DOMAIN`, `COMPANY_BRAND_COLOR`, `COMPANY_OFFICE_CITY`, `COMPANY_OFFICE_ADDRESS` | Branding |
| `AUTH_USERS`, `AUTH_SESSION_SECRET` (32+ chars, random)    | Login                        |
| `AZURE_OPENAI_CHAT_*` (endpoint, key, version, deployment) | Chat                         |
| `AZURE_OPENAI_REALTIME_*`                                  | Voice                        |
| `AZURE_COMM_CONNECTION_STRING`, `AZURE_COMM_SENDER_ADDRESS` | Email                       |
| `TAVILY_API_KEY`                                           | Hotel suggestions (optional) |
| `DEMO_EMAIL_OVERRIDE`                                      | Strongly recommended for the first run — routes all outbound mail to your inbox |

Generate a session secret:

```bash
openssl rand -hex 32
```

### 4. Build + run

```bash
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml logs -f orchestrator portal
```

The first build takes 5–10 minutes (npm install + next build). On a B2s
expect occasional OOM during `next build` — bump to B2ms or add a swap file
if it fails:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile \
  && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 5. Seed master data + candidates

The orchestrator container reads `master-data/` and `seed-data/` at boot, but
the cascade UI is empty until you seed Redis:

```bash
docker compose -f deploy/docker-compose.yml exec orchestrator \
  node -e "require('./packages/orchestrator/dist/scripts/seed.js')"
# OR run the script from a one-off node container that mounts the repo
```

(For the demo path, you can also `npm install && npm run reset` on the host
once Node 20 is installed — the script connects to the same Redis the
containers use.)

### 6. nginx reverse proxy + Let's Encrypt

WebRTC requires HTTPS. Front the portal with nginx:

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo tee /etc/nginx/sites-available/hr-ai <<'EOF'
server {
    listen 80;
    server_name hr-ai.example.com;

    # SSE needs long timeouts and disabled buffering
    proxy_read_timeout 1d;
    proxy_send_timeout 1d;
    proxy_buffering off;

    location /api/events {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/hr-ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d hr-ai.example.com --redirect --agree-tos -m you@example.com
```

The orchestrator (port 3001) stays bound to localhost — only the portal is
exposed publicly. The portal proxies to it inside the docker network.

### 7. Auto-restart on reboot

Compose v2's `restart: unless-stopped` works, but a tiny systemd unit is
cleaner if you want logs in `journalctl`:

```bash
sudo tee /etc/systemd/system/hr-ai.service <<EOF
[Unit]
Description=HR.AI docker compose stack
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/$USER/hr-ai
ExecStart=/usr/bin/docker compose -f deploy/docker-compose.yml up -d --build
ExecStop=/usr/bin/docker compose -f deploy/docker-compose.yml down

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now hr-ai
```

### 8. Updates

```bash
cd ~/hr-ai
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

### 9. Hardening before going live

The login is plaintext — non-negotiable for a public URL. Either:

1. Replace it with Azure AD / Entra ID at the `/api/auth/*` boundary, or
2. Put the whole site behind an Azure Application Gateway / Front Door with
   IP allow-listing while you demo.

Other things to check before demo day:

- Set `DEMO_EMAIL_OVERRIDE` to your inbox during your first end-to-end run
- Rotate `AUTH_SESSION_SECRET` from any committed/example value
- Enable Azure Backup on the VM disk if Redis state matters between runs
  (it doesn't, for the demo — `npm run reset` is destructive by design)
- Open Azure NSG to your laptop's IP only for SSH

---

## License

Private. No license granted.
