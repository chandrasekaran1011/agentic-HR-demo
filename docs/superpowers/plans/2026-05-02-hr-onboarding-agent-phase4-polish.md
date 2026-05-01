# HR Onboarding Agent — Phase 4: Admin Master Data + Big-Number Reveals + Rehearse

**Goal:** Add the admin master-data screens (Role × Software matrix is the hero), animate the closing big-number reveals on `/admin`, ship a `npm run rehearse` dry-run script. Polish the demo end-state.

**Scope:**

### P4.1 Admin master-data section
- `/admin/master-data` index page linking to each master
- `/admin/master-data/roles` — CRUD list of roles
- `/admin/master-data/software` — CRUD list of software catalog
- `/admin/master-data/role-software-matrix` — checkbox grid (★ hero screen)
- `/admin/master-data/training-matrix` — by-role training requirements
- `/admin/master-data/teams` — list of teams with buddy pool
- API endpoints: `GET /api/master-data/*` (read), `POST /api/master-data/role-software-matrix/toggle` (toggle a cell)

### P4.2 Big-number reveal on /admin
- Animate counters from 0 to final value over 1.5s on mount
- Add: total candidates, in-progress, complete, time saved (sum across cascades), avg cascade duration
- Recent activity feed: last 10 events from `agent:events` via SSE

### P4.3 Rehearse script
- `npm run rehearse` does:
  - Reset Redis (flush + reseed)
  - Print env diagnostics (which Azure resources configured)
  - Probe each (chat, voice session, ACS) and print pass/fail
  - Trigger a test cascade for Karan Shah
  - Wait for cascade.complete
  - Print run summary

### P4.4 README + demo day checklist
- Stage prep: window setup, mic, projector, browser fullscreen
- Pre-demo: reset, probe, rehearse
- During demo: 4-act script summary
- Recovery: F5 reload, manual onboard fallback

### P4.5 Tag phase-4-complete
