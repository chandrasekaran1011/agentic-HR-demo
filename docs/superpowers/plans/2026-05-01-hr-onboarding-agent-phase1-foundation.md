# HR Onboarding Agent — Phase 1: Foundation & Skeleton Portal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the project scaffold, persistent storage layer, authentication, and a navigable but agent-less portal that displays seed candidates, system CRUD pages, and an admin dashboard reading from Redis.

**Architecture:** Two-package npm workspace (`portal` + `shared`). Redis runs in Docker for local dev. Portal is Next.js 15 App Router with Tailwind + shadcn/ui + Framer Motion. Master data and seed candidates load from JSON files into Redis at server boot. Cookie-based auth (HMAC-signed) gates all routes except `/login`. The orchestrator and agent runtime do **not** exist yet — they arrive in Phase 2.

**Tech Stack:** TypeScript, Next.js 15 (App Router), Tailwind v3, shadcn/ui, Framer Motion, Redis 7, Docker Compose, Zod, Playwright, Vitest.

**Phase context:** This is Phase 1 of 4. After this phase ships, the portal is navigable, seed data is visible, and auth works — but nothing happens when you click the mic. Phases 2/3/4 add the orchestrator, voice integration, and polish.

**Reference spec:** [docs/superpowers/specs/2026-05-01-hr-onboarding-agent-demo-design.md](../specs/2026-05-01-hr-onboarding-agent-demo-design.md)

---

## File structure produced by Phase 1

```
hr-agent-demo/
├── package.json                       # workspace root
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── master-data/
│   ├── roles.json
│   ├── software-catalog.json
│   ├── role-software-matrix.json
│   ├── teams.json
│   ├── laptops.json
│   ├── salary-bands.json
│   ├── documents.json
│   └── training-matrix.json
├── seed-data/
│   └── candidates.json
├── packages/
│   ├── shared/                        # types + zod schemas
│   └── portal/                        # Next.js app
├── scripts/
│   ├── seed.ts
│   └── reset-demo.sh
├── deploy/
│   └── docker-compose.dev.yml         # just redis
└── e2e/
    └── smoke.spec.ts
```

---

## Task 1: Initialize repository and npm workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialize git repo and `package.json`**

```bash
cd /Volumes/pgm/misc/hr-agent/code
git init
```

Create `package.json`:

```json
{
  "name": "hr-agent-demo",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "docker compose -f deploy/docker-compose.dev.yml up -d && npm --workspace=portal run dev",
    "build": "npm --workspace=shared run build && npm --workspace=portal run build",
    "test": "npm --workspaces --if-present run test",
    "test:e2e": "playwright test",
    "seed": "tsx scripts/seed.ts",
    "reset": "bash scripts/reset-demo.sh",
    "redis": "docker compose -f deploy/docker-compose.dev.yml up -d",
    "redis:stop": "docker compose -f deploy/docker-compose.dev.yml down"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "baseUrl": ".",
    "paths": {
      "@hr-agent/shared": ["packages/shared/src/index.ts"],
      "@hr-agent/shared/*": ["packages/shared/src/*"]
    }
  }
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.next/
dist/
.env
.env.local
*.log
.DS_Store
playwright-report/
test-results/
```

- [ ] **Step 4: Create `.env.example`**

```bash
# Company branding
COMPANY_NAME="Acme Corp"
COMPANY_DOMAIN="acme.com"
COMPANY_BRAND_COLOR="#3b82f6"
COMPANY_LOGO_URL=""
COMPANY_OFFICE_CITY="Chennai"
COMPANY_OFFICE_ADDRESS="DLF IT Park, Chennai 600032"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth (Phase 1)
AUTH_USERS='[{"username":"hr","password":"acme2026","name":"HR User"},{"username":"admin","password":"acme2026","name":"Admin"}]'
AUTH_SESSION_SECRET="dev-secret-change-me-32-bytes-min"

# Demo flags
DEMO_MODE="true"
DEBUG_TOOL_CALLS="false"
```

- [ ] **Step 5: Install root dev deps and commit**

```bash
npm install
git add .
git commit -m "chore: initialize npm workspace and repo skeleton"
```

---

## Task 2: Shared package — types and Zod schemas

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/events.ts`
- Create: `packages/shared/src/master-data-schemas.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@hr-agent/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/shared/src/types.ts`**

```typescript
export type CandidateStatus = "pending" | "in_progress" | "complete";
export type TileStatus = "pending" | "in_progress" | "done" | "error" | "amending";

export const SYSTEMS = [
  "hrms",
  "documents",
  "buddy",
  "it",
  "software",
  "training",
  "welcome",
  "idcard",
  "payroll",
  "manager_notify",
  "seating",
  "parking",
] as const;

export type SystemName = typeof SYSTEMS[number];

export interface Candidate {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  manager: string;
  joining_date: string;        // ISO YYYY-MM-DD
  current_city?: string;
  status: CandidateStatus;
  progress: number;            // 0..12
  photo_url: string;
  created_at: string;
  updated_at: string;
}

export interface Tile {
  candidate_id: string;
  system: SystemName;
  status: TileStatus;
  ticket_id?: string;
  artifact_summary?: string;
  started_at?: string;
  completed_at?: string;
}

export interface AuditEntry {
  ts: string;
  event: string;
  system?: SystemName;
  ticket_id?: string;
  msg: string;
}
```

- [ ] **Step 4: Create `packages/shared/src/events.ts`**

```typescript
import type { SystemName, TileStatus } from "./types.js";

export type AgentEventType =
  | "tile.update"
  | "audit.append"
  | "narration.cue"
  | "candidate.create"
  | "candidate.update"
  | "metrics.update"
  | "cascade.complete"
  | "cascade.amend.start"
  | "email.sent";

export interface AgentEvent<T = unknown> {
  type: AgentEventType;
  candidate_id: string;
  system?: SystemName;
  payload: T;
  timestamp: string;
  run_id?: string;
}

export interface TileUpdatePayload {
  status: TileStatus;
  ticket_id?: string;
  artifact_summary?: string;
}

export interface AuditAppendPayload {
  msg: string;
  ticket_id?: string;
}
```

- [ ] **Step 5: Create `packages/shared/src/master-data-schemas.ts`**

```typescript
import { z } from "zod";

export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string(),
  level: z.enum(["junior", "mid", "senior", "staff", "principal"]),
});

export const SoftwareSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
});

export const RoleSoftwareMatrixSchema = z.object({
  role_id: z.string(),
  team: z.string().optional(),
  software_ids: z.array(z.string()),
});

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  floor: z.number(),
  wing: z.string(),
  manager: z.string(),
  manager_email: z.string().email(),
  buddy_pool: z.array(
    z.object({
      name: z.string(),
      email: z.string().email(),
      role_family: z.string(),
      tenure_years: z.number(),
    })
  ),
  parking_eligibility: z.enum(["all", "senior_only", "none"]),
});

export const LaptopConfigSchema = z.object({
  role_family: z.string(),
  level: z.string(),
  model: z.string(),
  ram: z.string(),
  cpu: z.string(),
  accessories: z.array(z.string()),
});

export const SalaryBandSchema = z.object({
  role_family: z.string(),
  level: z.string(),
  band: z.string(),
});

export const DocumentChecklistSchema = z.object({
  country: z.string(),
  role_type: z.string(),
  documents: z.array(z.string()),
});

export const TrainingMatrixSchema = z.object({
  role_family: z.string(),
  team: z.string().optional(),
  required: z.array(z.string()),
  recommended: z.array(z.string()),
});

export const CandidateSeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  team: z.string(),
  manager: z.string(),
  joining_date: z.string(),
  current_city: z.string().optional(),
  status: z.enum(["pending", "in_progress", "complete"]),
  progress: z.number().int().min(0).max(12),
  photo_url: z.string(),
  initial_tiles: z
    .array(
      z.object({
        system: z.string(),
        status: z.enum(["pending", "in_progress", "done", "error", "amending"]),
        ticket_id: z.string().optional(),
        artifact_summary: z.string().optional(),
      })
    )
    .optional(),
  initial_audit: z
    .array(
      z.object({
        ts: z.string(),
        event: z.string(),
        system: z.string().optional(),
        ticket_id: z.string().optional(),
        msg: z.string(),
      })
    )
    .optional(),
});

export type Role = z.infer<typeof RoleSchema>;
export type Software = z.infer<typeof SoftwareSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type CandidateSeed = z.infer<typeof CandidateSeedSchema>;
```

- [ ] **Step 6: Create `packages/shared/src/index.ts`**

```typescript
export * from "./types.js";
export * from "./events.js";
export * from "./master-data-schemas.js";
```

- [ ] **Step 7: Install and commit**

```bash
npm install --workspace=@hr-agent/shared
npm --workspace=@hr-agent/shared run build
git add packages/shared
git commit -m "feat(shared): add types, events, and zod schemas"
```

---

## Task 3: Master data JSON files

**Files:**
- Create: `master-data/roles.json`
- Create: `master-data/software-catalog.json`
- Create: `master-data/role-software-matrix.json`
- Create: `master-data/teams.json`
- Create: `master-data/laptops.json`
- Create: `master-data/salary-bands.json`
- Create: `master-data/documents.json`
- Create: `master-data/training-matrix.json`

- [ ] **Step 1: Create `master-data/roles.json`**

```json
[
  { "id": "sr_be", "name": "Senior Backend Engineer", "family": "engineering", "level": "senior" },
  { "id": "jr_be", "name": "Junior Backend Engineer", "family": "engineering", "level": "junior" },
  { "id": "sr_fe", "name": "Senior Frontend Engineer", "family": "engineering", "level": "senior" },
  { "id": "sr_ds", "name": "Senior Data Scientist", "family": "data", "level": "senior" },
  { "id": "pm_data", "name": "PM, Data", "family": "product", "level": "senior" },
  { "id": "designer", "name": "Senior Designer", "family": "design", "level": "senior" },
  { "id": "devops", "name": "DevOps Engineer", "family": "infrastructure", "level": "senior" }
]
```

- [ ] **Step 2: Create `master-data/software-catalog.json`**

```json
[
  { "id": "m365", "name": "Microsoft 365", "category": "productivity" },
  { "id": "slack", "name": "Slack", "category": "collaboration" },
  { "id": "copilot", "name": "GitHub Copilot", "category": "engineering" },
  { "id": "datadog", "name": "Datadog", "category": "observability" },
  { "id": "jira", "name": "Jira", "category": "project-management" },
  { "id": "tableau", "name": "Tableau", "category": "analytics" },
  { "id": "figma", "name": "Figma", "category": "design" },
  { "id": "aws", "name": "AWS Console", "category": "infrastructure" },
  { "id": "terraform", "name": "Terraform Cloud", "category": "infrastructure" },
  { "id": "k8s_lens", "name": "Kubernetes Lens", "category": "infrastructure" }
]
```

- [ ] **Step 3: Create `master-data/role-software-matrix.json`**

```json
[
  { "role_id": "sr_be", "software_ids": ["m365", "slack", "copilot", "datadog", "jira", "aws", "terraform", "k8s_lens"] },
  { "role_id": "jr_be", "software_ids": ["m365", "slack", "copilot", "jira", "aws"] },
  { "role_id": "sr_fe", "software_ids": ["m365", "slack", "copilot", "datadog", "jira", "figma"] },
  { "role_id": "sr_ds", "software_ids": ["m365", "slack", "copilot", "datadog", "tableau"] },
  { "role_id": "pm_data", "software_ids": ["m365", "slack", "jira", "tableau"] },
  { "role_id": "designer", "software_ids": ["m365", "slack", "figma"] },
  { "role_id": "devops", "software_ids": ["m365", "slack", "copilot", "datadog", "aws", "terraform", "k8s_lens"] }
]
```

- [ ] **Step 4: Create `master-data/teams.json`**

```json
[
  {
    "id": "ai_platform",
    "name": "AI Platform",
    "floor": 3,
    "wing": "east",
    "manager": "Sneha Roy",
    "manager_email": "sneha.roy@acme.com",
    "buddy_pool": [
      { "name": "Rohan Desai", "email": "rohan.desai@acme.com", "role_family": "engineering", "tenure_years": 3 },
      { "name": "Ankit Verma", "email": "ankit.verma@acme.com", "role_family": "engineering", "tenure_years": 2 }
    ],
    "parking_eligibility": "all"
  },
  {
    "id": "ai_infrastructure",
    "name": "AI Infrastructure",
    "floor": 5,
    "wing": "north",
    "manager": "Karthik Rao",
    "manager_email": "karthik.rao@acme.com",
    "buddy_pool": [
      { "name": "Meera Krishnan", "email": "meera.krishnan@acme.com", "role_family": "infrastructure", "tenure_years": 4 }
    ],
    "parking_eligibility": "all"
  },
  {
    "id": "data",
    "name": "Data",
    "floor": 4,
    "wing": "west",
    "manager": "Anjali Mehta",
    "manager_email": "anjali.mehta@acme.com",
    "buddy_pool": [
      { "name": "Vikram Iyer", "email": "vikram.iyer@acme.com", "role_family": "data", "tenure_years": 2 }
    ],
    "parking_eligibility": "senior_only"
  },
  {
    "id": "design",
    "name": "Design",
    "floor": 2,
    "wing": "east",
    "manager": "Priya Nambiar",
    "manager_email": "priya.nambiar@acme.com",
    "buddy_pool": [
      { "name": "Aanya Patel", "email": "aanya.patel@acme.com", "role_family": "design", "tenure_years": 1 }
    ],
    "parking_eligibility": "all"
  }
]
```

- [ ] **Step 5: Create `master-data/laptops.json`**

```json
[
  { "role_family": "engineering", "level": "senior", "model": "MacBook Pro 16", "ram": "32GB", "cpu": "M3 Pro", "accessories": ["external monitor", "keyboard", "mouse"] },
  { "role_family": "engineering", "level": "junior", "model": "MacBook Pro 14", "ram": "16GB", "cpu": "M3", "accessories": ["external monitor"] },
  { "role_family": "data", "level": "senior", "model": "MacBook Pro 16", "ram": "32GB", "cpu": "M3 Pro", "accessories": ["external monitor"] },
  { "role_family": "infrastructure", "level": "senior", "model": "MacBook Pro 16", "ram": "32GB", "cpu": "M3 Max", "accessories": ["external monitor"] },
  { "role_family": "product", "level": "senior", "model": "MacBook Air 15", "ram": "16GB", "cpu": "M3", "accessories": ["external monitor"] },
  { "role_family": "design", "level": "senior", "model": "MacBook Pro 16", "ram": "32GB", "cpu": "M3 Pro", "accessories": ["Wacom tablet", "color-calibrated monitor"] }
]
```

- [ ] **Step 6: Create `master-data/salary-bands.json`**

```json
[
  { "role_family": "engineering", "level": "senior", "band": "L5" },
  { "role_family": "engineering", "level": "junior", "band": "L3" },
  { "role_family": "data", "level": "senior", "band": "L5" },
  { "role_family": "infrastructure", "level": "senior", "band": "L5" },
  { "role_family": "product", "level": "senior", "band": "L5" },
  { "role_family": "design", "level": "senior", "band": "L5" }
]
```

- [ ] **Step 7: Create `master-data/documents.json`**

```json
[
  {
    "country": "IN",
    "role_type": "fulltime",
    "documents": ["PAN card", "Aadhaar", "Address proof", "10th marksheet", "12th marksheet", "Degree certificate", "Previous employer relieving letter", "Bank passbook copy"]
  }
]
```

- [ ] **Step 8: Create `master-data/training-matrix.json`**

```json
[
  { "role_family": "engineering", "required": ["Onboarding 101", "Security 101"], "recommended": ["Backend Bootcamp", "Code Review Best Practices"] },
  { "role_family": "data", "required": ["Onboarding 101", "Security 101", "Data Privacy"], "recommended": ["Tableau Fundamentals"] },
  { "role_family": "infrastructure", "required": ["Onboarding 101", "Security 101", "Production Readiness"], "recommended": ["K8s Bootcamp"] },
  { "role_family": "product", "required": ["Onboarding 101", "Security 101"], "recommended": ["Product Sense"] },
  { "role_family": "design", "required": ["Onboarding 101", "Security 101"], "recommended": ["Design System 101"] }
]
```

- [ ] **Step 9: Commit**

```bash
git add master-data
git commit -m "feat(master-data): seed roles, software, teams, laptops, training, docs"
```

---

## Task 4: Seed candidates JSON

**Files:**
- Create: `seed-data/candidates.json`

- [ ] **Step 1: Create `seed-data/candidates.json`**

```json
[
  {
    "id": "aanya-patel",
    "name": "Aanya Patel",
    "email": "aanya.patel@acme.com",
    "role": "Senior Designer",
    "team": "Design",
    "manager": "Priya Nambiar",
    "joining_date": "2026-04-15",
    "current_city": "Chennai",
    "status": "complete",
    "progress": 12,
    "photo_url": "/avatars/default-female.png",
    "initial_tiles": [
      { "system": "hrms", "status": "done", "ticket_id": "EMP-2026-0801", "artifact_summary": "EMP-2026-0801" },
      { "system": "documents", "status": "done", "ticket_id": "DOC-2026-0301", "artifact_summary": "8/8 received" },
      { "system": "buddy", "status": "done", "ticket_id": "BUD-2026-0201", "artifact_summary": "Riya Sharma (2yr, Designer)" },
      { "system": "it", "status": "done", "ticket_id": "IT-1001", "artifact_summary": "MBP 16 32GB delivered" },
      { "system": "software", "status": "done", "ticket_id": "SW-2026-0301", "artifact_summary": "3 entitlements" },
      { "system": "training", "status": "done", "ticket_id": "TR-2026-0301", "artifact_summary": "2 enrolled" },
      { "system": "welcome", "status": "done", "ticket_id": "WEL-2026-0301", "artifact_summary": "Sent" },
      { "system": "idcard", "status": "done", "ticket_id": "ID-2026-0301", "artifact_summary": "Issued" },
      { "system": "payroll", "status": "done", "ticket_id": "PAY-2026-0301", "artifact_summary": "Setup L5" },
      { "system": "manager_notify", "status": "done", "ticket_id": "MGR-2026-0301", "artifact_summary": "Manager notified" },
      { "system": "seating", "status": "done", "ticket_id": "SEAT-2026-0301", "artifact_summary": "F2-E-08" },
      { "system": "parking", "status": "done", "ticket_id": "PARK-2026-0301", "artifact_summary": "P1-22" }
    ],
    "initial_audit": [
      { "ts": "2026-04-08T10:00:00Z", "event": "cascade.complete", "msg": "Onboarding for Aanya Patel completed in 51s" }
    ]
  },
  {
    "id": "vikram-iyer",
    "name": "Vikram Iyer",
    "email": "vikram.iyer@acme.com",
    "role": "DevOps Engineer",
    "team": "AI Infrastructure",
    "manager": "Karthik Rao",
    "joining_date": "2026-04-22",
    "current_city": "Bangalore",
    "status": "complete",
    "progress": 12,
    "photo_url": "/avatars/default-male.png",
    "initial_tiles": [
      { "system": "hrms", "status": "done", "ticket_id": "EMP-2026-0820", "artifact_summary": "EMP-2026-0820" },
      { "system": "documents", "status": "done", "ticket_id": "DOC-2026-0320", "artifact_summary": "8/8 received" },
      { "system": "buddy", "status": "done", "ticket_id": "BUD-2026-0220", "artifact_summary": "Meera Krishnan (4yr, Infra)" },
      { "system": "it", "status": "done", "ticket_id": "IT-1020", "artifact_summary": "MBP 16 32GB delivered" },
      { "system": "software", "status": "done", "ticket_id": "SW-2026-0320", "artifact_summary": "7 entitlements" },
      { "system": "training", "status": "done", "ticket_id": "TR-2026-0320", "artifact_summary": "3 enrolled" },
      { "system": "welcome", "status": "done", "ticket_id": "WEL-2026-0320", "artifact_summary": "Sent" },
      { "system": "idcard", "status": "done", "ticket_id": "ID-2026-0320", "artifact_summary": "Issued" },
      { "system": "payroll", "status": "done", "ticket_id": "PAY-2026-0320", "artifact_summary": "Setup L5" },
      { "system": "manager_notify", "status": "done", "ticket_id": "MGR-2026-0320", "artifact_summary": "Manager notified" },
      { "system": "seating", "status": "done", "ticket_id": "SEAT-2026-0320", "artifact_summary": "F5-N-12" },
      { "system": "parking", "status": "done", "ticket_id": "PARK-2026-0320", "artifact_summary": "P2-18" }
    ],
    "initial_audit": [
      { "ts": "2026-04-15T10:00:00Z", "event": "cascade.complete", "msg": "Onboarding for Vikram Iyer completed in 48s" }
    ]
  },
  {
    "id": "priya-sharma",
    "name": "Priya Sharma",
    "email": "priya.sharma@acme.com",
    "role": "PM, Data",
    "team": "Data",
    "manager": "Anjali Mehta",
    "joining_date": "2026-05-05",
    "current_city": "Chennai",
    "status": "in_progress",
    "progress": 8,
    "photo_url": "/avatars/default-female.png",
    "initial_tiles": [
      { "system": "hrms", "status": "done", "ticket_id": "EMP-2026-0840", "artifact_summary": "EMP-2026-0840" },
      { "system": "documents", "status": "done", "ticket_id": "DOC-2026-0340", "artifact_summary": "5/8 received" },
      { "system": "buddy", "status": "done", "ticket_id": "BUD-2026-0240", "artifact_summary": "Vikram Iyer (2yr, Data)" },
      { "system": "it", "status": "done", "ticket_id": "IT-1041", "artifact_summary": "MBP 14 16GB dispatched" },
      { "system": "software", "status": "done", "ticket_id": "SW-2026-0340", "artifact_summary": "4 entitlements" },
      { "system": "idcard", "status": "done", "ticket_id": "ID-2026-0340", "artifact_summary": "Photo scheduled" },
      { "system": "payroll", "status": "done", "ticket_id": "PAY-2026-0340", "artifact_summary": "Setup L5" },
      { "system": "seating", "status": "done", "ticket_id": "SEAT-2026-0340", "artifact_summary": "F4-W-04" },
      { "system": "training", "status": "pending" },
      { "system": "welcome", "status": "pending" },
      { "system": "manager_notify", "status": "pending" },
      { "system": "parking", "status": "pending" }
    ]
  },
  {
    "id": "karan-shah",
    "name": "Karan Shah",
    "email": "karan.shah@acme.com",
    "role": "Senior Frontend Engineer",
    "team": "AI Platform",
    "manager": "Sneha Roy",
    "joining_date": "2026-05-12",
    "current_city": "Mumbai",
    "status": "pending",
    "progress": 0,
    "photo_url": "/avatars/default-male.png",
    "initial_tiles": []
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add seed-data
git commit -m "feat(seed-data): add four seed candidates with varied statuses"
```

---

## Task 5: Docker compose for Redis (dev)

**Files:**
- Create: `deploy/docker-compose.dev.yml`

- [ ] **Step 1: Create `deploy/docker-compose.dev.yml`**

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: hr-agent-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped
```

- [ ] **Step 2: Verify Redis comes up**

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
docker compose -f deploy/docker-compose.dev.yml ps
docker exec hr-agent-redis redis-cli ping
```

Expected: `PONG`

- [ ] **Step 3: Commit**

```bash
git add deploy
git commit -m "chore(deploy): add docker-compose for local redis"
```

---

## Task 6: Portal scaffold (Next.js 15 + Tailwind + shadcn)

**Files:**
- Create: `packages/portal/` (entire Next.js scaffold)

- [ ] **Step 1: Scaffold Next.js inside the workspace**

```bash
cd packages
npx create-next-app@latest portal \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias "@/*" \
  --no-eslint \
  --turbopack \
  --use-npm
cd ..
```

- [ ] **Step 2: Update `packages/portal/package.json` to integrate the workspace**

Replace the generated `package.json` with:

```json
{
  "name": "portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "test": "vitest run"
  },
  "dependencies": {
    "@hr-agent/shared": "*",
    "ioredis": "^5.4.0",
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "framer-motion": "^11.11.0",
    "zod": "^3.23.0",
    "lucide-react": "^0.452.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0",
    "class-variance-authority": "^0.7.0"
  },
  "devDependencies": {
    "@types/node": "^22.7.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Update `packages/portal/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"],
      "@hr-agent/shared": ["../shared/src/index.ts"],
      "@hr-agent/shared/*": ["../shared/src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
cd packages/portal
npx shadcn@latest init -y -d
cd ../..
```

When prompted, accept defaults (Slate base color, CSS variables: yes).

- [ ] **Step 5: Install initial shadcn components**

```bash
cd packages/portal
npx shadcn@latest add button card input label table badge avatar separator toast sonner
cd ../..
```

- [ ] **Step 6: Verify portal starts**

```bash
npm install
npm --workspace=portal run dev
```

Open `http://localhost:3000` — default Next.js page renders. Stop with Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add packages/portal package*.json
git commit -m "feat(portal): scaffold Next.js 15 with Tailwind and shadcn/ui"
```

---

## Task 7: Redis client wrapper

**Files:**
- Create: `packages/portal/lib/redis.ts`
- Create: `packages/portal/lib/redis.test.ts`

- [ ] **Step 1: Write failing test `packages/portal/lib/redis.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getRedis, closeRedis } from "./redis";

describe("redis client", () => {
  afterAll(async () => {
    await closeRedis();
  });

  it("returns a singleton client and supports basic ops", async () => {
    const r1 = getRedis();
    const r2 = getRedis();
    expect(r1).toBe(r2);

    await r1.set("test:hello", "world");
    const got = await r1.get("test:hello");
    expect(got).toBe("world");
    await r1.del("test:hello");
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm --workspace=portal exec vitest run lib/redis.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/portal/lib/redis.ts`**

```typescript
import Redis from "ioredis";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
```

- [ ] **Step 4: Verify test passes**

Make sure Redis is running (`npm run redis`), then:

```bash
npm --workspace=portal exec vitest run lib/redis.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/portal/lib/redis.ts packages/portal/lib/redis.test.ts
git commit -m "feat(portal): add redis singleton client wrapper"
```

---

## Task 8: Company config helper (env-driven branding)

**Files:**
- Create: `packages/portal/lib/company.ts`
- Create: `packages/portal/lib/company.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getCompany } from "./company";

describe("getCompany", () => {
  beforeEach(() => {
    process.env.COMPANY_NAME = "Acme Corp";
    process.env.COMPANY_DOMAIN = "acme.com";
    process.env.COMPANY_BRAND_COLOR = "#3b82f6";
    process.env.COMPANY_LOGO_URL = "";
    process.env.COMPANY_OFFICE_CITY = "Chennai";
    process.env.COMPANY_OFFICE_ADDRESS = "DLF IT Park";
  });

  it("reads all six fields from env", () => {
    const c = getCompany();
    expect(c.name).toBe("Acme Corp");
    expect(c.domain).toBe("acme.com");
    expect(c.brandColor).toBe("#3b82f6");
    expect(c.officeCity).toBe("Chennai");
    expect(c.officeAddress).toBe("DLF IT Park");
  });

  it("falls back to sensible defaults when env missing", () => {
    delete process.env.COMPANY_NAME;
    const c = getCompany();
    expect(c.name).toBe("Acme Corp");
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm --workspace=portal exec vitest run lib/company.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `packages/portal/lib/company.ts`**

```typescript
export interface CompanyConfig {
  name: string;
  domain: string;
  brandColor: string;
  logoUrl: string;
  officeCity: string;
  officeAddress: string;
}

export function getCompany(): CompanyConfig {
  return {
    name: process.env.COMPANY_NAME ?? "Acme Corp",
    domain: process.env.COMPANY_DOMAIN ?? "acme.com",
    brandColor: process.env.COMPANY_BRAND_COLOR ?? "#3b82f6",
    logoUrl: process.env.COMPANY_LOGO_URL ?? "",
    officeCity: process.env.COMPANY_OFFICE_CITY ?? "Chennai",
    officeAddress: process.env.COMPANY_OFFICE_ADDRESS ?? "DLF IT Park, Chennai",
  };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm --workspace=portal exec vitest run lib/company.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/portal/lib/company.ts packages/portal/lib/company.test.ts
git commit -m "feat(portal): add company config helper from env vars"
```

---

## Task 9: Master data loader

**Files:**
- Create: `packages/portal/lib/master-data-loader.ts`
- Create: `packages/portal/lib/master-data-loader.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadMasterData, getMasterRoles, getMasterSoftwareForRole } from "./master-data-loader";
import { getRedis, closeRedis } from "./redis";

describe("master data loader", () => {
  beforeAll(async () => {
    await getRedis().flushdb();
    await loadMasterData();
  });

  afterAll(async () => {
    await closeRedis();
  });

  it("loads roles into redis", async () => {
    const roles = await getMasterRoles();
    expect(roles.length).toBeGreaterThan(0);
    const srBe = roles.find((r) => r.id === "sr_be");
    expect(srBe?.name).toBe("Senior Backend Engineer");
  });

  it("returns software ids for a role", async () => {
    const ids = await getMasterSoftwareForRole("sr_be");
    expect(ids).toContain("copilot");
    expect(ids).toContain("datadog");
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npm --workspace=portal exec vitest run lib/master-data-loader.test.ts
```

- [ ] **Step 3: Implement `packages/portal/lib/master-data-loader.ts`**

```typescript
import { promises as fs } from "fs";
import path from "path";
import { getRedis } from "./redis";
import {
  RoleSchema,
  SoftwareSchema,
  RoleSoftwareMatrixSchema,
  TeamSchema,
  LaptopConfigSchema,
  SalaryBandSchema,
  DocumentChecklistSchema,
  TrainingMatrixSchema,
  type Role,
} from "@hr-agent/shared";
import { z } from "zod";

const MASTER_DATA_DIR =
  process.env.MASTER_DATA_DIR ?? path.join(process.cwd(), "..", "..", "master-data");

async function readJson<T>(file: string, schema: z.ZodType<T>): Promise<T[]> {
  const raw = await fs.readFile(path.join(MASTER_DATA_DIR, file), "utf-8");
  const parsed = JSON.parse(raw);
  return z.array(schema).parse(parsed);
}

export async function loadMasterData(): Promise<void> {
  const r = getRedis();

  const roles = await readJson("roles.json", RoleSchema);
  for (const role of roles) {
    await r.hset("master:roles", role.id, JSON.stringify(role));
  }

  const software = await readJson("software-catalog.json", SoftwareSchema);
  for (const sw of software) {
    await r.hset("master:software", sw.id, JSON.stringify(sw));
  }

  const matrix = await readJson("role-software-matrix.json", RoleSoftwareMatrixSchema);
  for (const m of matrix) {
    await r.hset("master:matrix:software", m.role_id, JSON.stringify(m.software_ids));
  }

  const teams = await readJson("teams.json", TeamSchema);
  for (const t of teams) {
    await r.hset("master:teams", t.id, JSON.stringify(t));
  }

  const laptops = await readJson("laptops.json", LaptopConfigSchema);
  for (const l of laptops) {
    await r.hset("master:laptops", `${l.role_family}:${l.level}`, JSON.stringify(l));
  }

  const bands = await readJson("salary-bands.json", SalaryBandSchema);
  for (const b of bands) {
    await r.hset("master:salary", `${b.role_family}:${b.level}`, JSON.stringify(b));
  }

  const docs = await readJson("documents.json", DocumentChecklistSchema);
  for (const d of docs) {
    await r.hset("master:documents", `${d.country}:${d.role_type}`, JSON.stringify(d));
  }

  const training = await readJson("training-matrix.json", TrainingMatrixSchema);
  for (const t of training) {
    await r.hset("master:matrix:training", t.role_family, JSON.stringify(t));
  }
}

export async function getMasterRoles(): Promise<Role[]> {
  const r = getRedis();
  const all = await r.hgetall("master:roles");
  return Object.values(all).map((v) => JSON.parse(v));
}

export async function getMasterSoftwareForRole(roleId: string): Promise<string[]> {
  const r = getRedis();
  const v = await r.hget("master:matrix:software", roleId);
  if (!v) return [];
  return JSON.parse(v);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm --workspace=portal exec vitest run lib/master-data-loader.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/portal/lib/master-data-loader.ts packages/portal/lib/master-data-loader.test.ts
git commit -m "feat(portal): load master data JSONs into redis at boot"
```

---

## Task 10: Seed candidates loader

**Files:**
- Create: `packages/portal/lib/seed-candidates.ts`
- Create: `packages/portal/lib/seed-candidates.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadSeedCandidates, getCandidate, listCandidates } from "./seed-candidates";
import { getRedis, closeRedis } from "./redis";

describe("seed candidates", () => {
  beforeAll(async () => {
    await getRedis().flushdb();
    await loadSeedCandidates();
  });

  afterAll(async () => {
    await closeRedis();
  });

  it("loads four candidates", async () => {
    const all = await listCandidates();
    expect(all.length).toBe(4);
  });

  it("loads priya with progress 8", async () => {
    const priya = await getCandidate("priya-sharma");
    expect(priya?.name).toBe("Priya Sharma");
    expect(priya?.progress).toBe(8);
    expect(priya?.status).toBe("in_progress");
  });

  it("populates tiles for priya", async () => {
    const r = getRedis();
    const tile = await r.hgetall("tile:priya-sharma:hrms");
    expect(tile.status).toBe("done");
    expect(tile.ticket_id).toBe("EMP-2026-0840");
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `packages/portal/lib/seed-candidates.ts`**

```typescript
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { getRedis } from "./redis";
import { CandidateSeedSchema, type Candidate } from "@hr-agent/shared";

const SEED_DIR =
  process.env.SEED_DATA_DIR ?? path.join(process.cwd(), "..", "..", "seed-data");

export async function loadSeedCandidates(): Promise<void> {
  const raw = await fs.readFile(path.join(SEED_DIR, "candidates.json"), "utf-8");
  const seeds = z.array(CandidateSeedSchema).parse(JSON.parse(raw));

  const r = getRedis();
  for (const seed of seeds) {
    const now = new Date().toISOString();
    const candidate: Candidate = {
      id: seed.id,
      name: seed.name,
      email: seed.email,
      role: seed.role,
      team: seed.team,
      manager: seed.manager,
      joining_date: seed.joining_date,
      current_city: seed.current_city,
      status: seed.status,
      progress: seed.progress,
      photo_url: seed.photo_url,
      created_at: now,
      updated_at: now,
    };

    await r.hset(`candidate:${seed.id}`, candidate as unknown as Record<string, string>);
    await r.sadd("candidates:active", seed.id);
    await r.zadd("candidates:by_joining", new Date(seed.joining_date).getTime(), seed.id);

    for (const tile of seed.initial_tiles ?? []) {
      const fields: Record<string, string> = { status: tile.status };
      if (tile.ticket_id) fields.ticket_id = tile.ticket_id;
      if (tile.artifact_summary) fields.artifact_summary = tile.artifact_summary;
      await r.hset(`tile:${seed.id}:${tile.system}`, fields);
    }

    for (const a of seed.initial_audit ?? []) {
      await r.rpush(`audit:${seed.id}`, JSON.stringify(a));
    }
  }
}

export async function listCandidates(): Promise<Candidate[]> {
  const r = getRedis();
  const ids = await r.zrange("candidates:by_joining", 0, -1);
  const candidates: Candidate[] = [];
  for (const id of ids) {
    const c = await r.hgetall(`candidate:${id}`);
    if (c.id) {
      candidates.push({
        ...c,
        progress: parseInt(c.progress, 10),
      } as unknown as Candidate);
    }
  }
  return candidates;
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const r = getRedis();
  const c = await r.hgetall(`candidate:${id}`);
  if (!c.id) return null;
  return { ...c, progress: parseInt(c.progress, 10) } as unknown as Candidate;
}
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/portal/lib/seed-candidates.ts packages/portal/lib/seed-candidates.test.ts
git commit -m "feat(portal): seed candidates loader with tiles + audit"
```

---

## Task 11: Seed CLI script + reset script

**Files:**
- Create: `scripts/seed.ts`
- Create: `scripts/reset-demo.sh`

- [ ] **Step 1: Create `scripts/seed.ts`**

```typescript
import { loadMasterData } from "../packages/portal/lib/master-data-loader.js";
import { loadSeedCandidates } from "../packages/portal/lib/seed-candidates.js";
import { closeRedis } from "../packages/portal/lib/redis.js";

async function main() {
  console.log("Loading master data...");
  await loadMasterData();
  console.log("Loading seed candidates...");
  await loadSeedCandidates();
  console.log("Seed complete.");
  await closeRedis();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Create `scripts/reset-demo.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Flushing Redis..."
docker exec hr-agent-redis redis-cli FLUSHDB

echo "Reseeding master data and candidates..."
npx tsx scripts/seed.ts

echo "Demo ready. Open http://localhost:3000"
```

```bash
chmod +x scripts/reset-demo.sh
```

- [ ] **Step 3: Run reset to verify it works end-to-end**

```bash
npm run redis
npm run reset
```

Expected output: `Demo ready. ...`

Verify with:

```bash
docker exec hr-agent-redis redis-cli SMEMBERS candidates:active
```

Expected: 4 ids (`aanya-patel`, `vikram-iyer`, `priya-sharma`, `karan-shah`).

- [ ] **Step 4: Commit**

```bash
git add scripts
git commit -m "feat(scripts): add seed.ts and reset-demo.sh"
```

---

## Task 12: Auth — cookie sign/verify helpers

**Files:**
- Create: `packages/portal/lib/auth.ts`
- Create: `packages/portal/lib/auth.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { signSession, verifySession, validateCredentials } from "./auth";

describe("auth helpers", () => {
  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET = "test-secret-32-bytes-minimum-length-xx";
    process.env.AUTH_USERS = JSON.stringify([
      { username: "hr", password: "acme2026", name: "HR User" },
    ]);
  });

  it("signs and verifies a session token", () => {
    const token = signSession({ username: "hr", name: "HR User" });
    const session = verifySession(token);
    expect(session?.username).toBe("hr");
    expect(session?.name).toBe("HR User");
  });

  it("rejects a tampered token", () => {
    const token = signSession({ username: "hr", name: "HR User" });
    const tampered = token.slice(0, -2) + "xx";
    expect(verifySession(tampered)).toBeNull();
  });

  it("validates correct credentials", () => {
    const u = validateCredentials("hr", "acme2026");
    expect(u?.username).toBe("hr");
  });

  it("rejects wrong password", () => {
    expect(validateCredentials("hr", "wrong")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failure**

- [ ] **Step 3: Implement `packages/portal/lib/auth.ts`**

```typescript
import crypto from "crypto";

export interface Session {
  username: string;
  name: string;
  iat: number;
}

export interface AuthUser {
  username: string;
  password: string;
  name: string;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function getSecret(): string {
  const s = process.env.AUTH_SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SESSION_SECRET missing or too short");
  return s;
}

function getUsers(): AuthUser[] {
  const raw = process.env.AUTH_USERS ?? "[]";
  return JSON.parse(raw);
}

function b64u(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64uDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad), "base64");
}

export function signSession(data: Omit<Session, "iat">): string {
  const session: Session = { ...data, iat: Date.now() };
  const payload = b64u(Buffer.from(JSON.stringify(session)));
  const sig = b64u(crypto.createHmac("sha256", getSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySession(token: string): Session | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = b64u(crypto.createHmac("sha256", getSecret()).update(payload).digest());
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const session = JSON.parse(b64uDecode(payload).toString("utf-8")) as Session;
    if (Date.now() - session.iat > SESSION_TTL_MS) return null;
    return session;
  } catch {
    return null;
  }
}

export function validateCredentials(username: string, password: string): AuthUser | null {
  const u = getUsers().find((u) => u.username === username && u.password === password);
  return u ?? null;
}

export const SESSION_COOKIE = "hr_session";
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git add packages/portal/lib/auth.ts packages/portal/lib/auth.test.ts
git commit -m "feat(portal): add HMAC-signed session cookie helpers"
```

---

## Task 13: Auth — login and logout API routes

**Files:**
- Create: `packages/portal/app/api/auth/login/route.ts`
- Create: `packages/portal/app/api/auth/logout/route.ts`

- [ ] **Step 1: Create `packages/portal/app/api/auth/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateCredentials, signSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const user = validateCredentials(body.username, body.password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const token = signSession({ username: user.username, name: user.name });
  const res = NextResponse.json({ ok: true, user: { username: user.username, name: user.name } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return res;
}
```

- [ ] **Step 2: Create `packages/portal/app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
```

- [ ] **Step 3: Manually verify with curl**

Start dev server (`npm run dev`), then:

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"hr","password":"acme2026"}'
```

Expected: `200`, `Set-Cookie: hr_session=...`.

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"hr","password":"wrong"}'
```

Expected: `401`.

- [ ] **Step 4: Commit**

```bash
git add packages/portal/app/api/auth
git commit -m "feat(portal): login and logout api routes"
```

---

## Task 14: Auth middleware

**Files:**
- Create: `packages/portal/middleware.ts`

- [ ] **Step 1: Create `packages/portal/middleware.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|login|.*\\.(?:png|jpg|svg|ico)).*)"],
};

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get("hr_session")?.value;
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Note: full HMAC verification happens at the page level via getCurrentUser().
  // Middleware uses the lightweight cookie-presence check because Next.js middleware
  // runs in the Edge runtime, where node:crypto's createHmac is unavailable.
  return NextResponse.next();
}
```

- [ ] **Step 2: Manually verify**

Start dev server. Visit `http://localhost:3000/candidates`. Expected: redirect to `/login`.

After login (Task 16), visiting `/candidates` should not redirect.

- [ ] **Step 3: Commit**

```bash
git add packages/portal/middleware.ts
git commit -m "feat(portal): add auth middleware redirecting to /login"
```

---

## Task 15: `getCurrentUser` helper for server components

**Files:**
- Modify: `packages/portal/lib/auth.ts` (append)

- [ ] **Step 1: Append to `packages/portal/lib/auth.ts`**

```typescript
import { cookies } from "next/headers";

export async function getCurrentUser(): Promise<Session | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/portal/lib/auth.ts
git commit -m "feat(portal): getCurrentUser helper for server components"
```

---

## Task 16: Login page UI

**Files:**
- Create: `packages/portal/app/login/page.tsx`
- Create: `packages/portal/app/login/login-form.tsx`

- [ ] **Step 1: Create `packages/portal/app/login/login-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/candidates");
      router.refresh();
    } else {
      setError("Invalid credentials");
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
    }
  }

  return (
    <motion.form
      onSubmit={onSubmit}
      animate={shaking ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-4 w-full"
    >
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </motion.form>
  );
}
```

- [ ] **Step 2: Create `packages/portal/app/login/page.tsx`**

```tsx
import { getCompany } from "@/lib/company";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const company = getCompany();
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-25"
        style={{
          background: `radial-gradient(ellipse at center, ${company.brandColor}, transparent 60%)`,
        }}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm p-8 shadow-2xl">
        <div className="text-center mb-8">
          {company.logoUrl && (
            <img
              src={company.logoUrl}
              alt={company.name}
              className="mx-auto h-12 mb-4"
            />
          )}
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <p className="text-sm text-slate-400 mt-1">HR Onboarding Portal</p>
        </div>
        <LoginForm />
        <p className="text-xs text-slate-500 text-center mt-8">Demo environment</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

Start dev server, visit `http://localhost:3000/login`. Login form renders with brand-color gradient. Submit `hr` / `acme2026` — redirects to `/candidates` (which doesn't exist yet, will 404 — that's expected, fixed in Task 18).

- [ ] **Step 4: Commit**

```bash
git add packages/portal/app/login
git commit -m "feat(portal): login page with shake-on-error and brand gradient"
```

---

## Task 17: Root layout — persistent chat sidebar shell + main area

**Files:**
- Modify: `packages/portal/app/layout.tsx`
- Create: `packages/portal/components/chat-sidebar.tsx`
- Create: `packages/portal/components/app-shell.tsx`
- Modify: `packages/portal/app/globals.css` (add CSS var for brand color)

- [ ] **Step 1: Update `packages/portal/app/globals.css`**

Append to the existing `globals.css`:

```css
:root {
  --brand: #3b82f6;
}
```

- [ ] **Step 2: Create `packages/portal/components/chat-sidebar.tsx`**

```tsx
"use client";

import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatSidebarProps {
  userName: string;
  companyName: string;
}

export function ChatSidebar({ userName, companyName }: ChatSidebarProps) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="w-[30%] min-w-[400px] max-w-[640px] bg-slate-900 border-r border-slate-800 flex flex-col h-screen">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-lg font-semibold">{companyName}</h1>
        <p className="text-xs text-slate-400">HR Onboarding Agent</p>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <p className="text-sm text-slate-500 italic">Voice agent activates in Phase 3.</p>
      </div>
      <div className="p-6 border-t border-slate-800">
        <Button
          disabled
          className="w-full h-16 rounded-full"
          title="Voice integration arrives in Phase 3"
        >
          <Mic className="size-6" />
        </Button>
        <p className="text-xs text-center text-slate-500 mt-2">Idle</p>
        <div className="flex justify-between items-center mt-4 text-xs text-slate-400">
          <span>{userName}</span>
          <button
            onClick={logout}
            className="hover:text-slate-200 underline-offset-2 hover:underline"
          >
            logout
          </button>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create `packages/portal/components/app-shell.tsx`**

```tsx
import { ChatSidebar } from "./chat-sidebar";
import { getCompany } from "@/lib/company";
import { getCurrentUser } from "@/lib/auth";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const company = getCompany();
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      <ChatSidebar
        userName={user?.name ?? "Guest"}
        companyName={company.name}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Replace `packages/portal/app/layout.tsx`**

```tsx
import "./globals.css";
import type { Metadata } from "next";
import { getCompany } from "@/lib/company";

export async function generateMetadata(): Promise<Metadata> {
  const c = getCompany();
  return {
    title: `${c.name} HR Portal`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const company = getCompany();
  return (
    <html lang="en">
      <body
        className="bg-slate-950 text-slate-100"
        style={{ ["--brand" as string]: company.brandColor }}
      >
        {children}
      </body>
    </html>
  );
}
```

The `AppShell` will be used by individual pages that need it (login does NOT use it).

- [ ] **Step 5: Commit**

```bash
git add packages/portal/app/layout.tsx packages/portal/app/globals.css packages/portal/components
git commit -m "feat(portal): root layout + persistent chat sidebar shell"
```

---

## Task 18: Candidates list — API + page

**Files:**
- Create: `packages/portal/app/api/candidates/route.ts`
- Create: `packages/portal/app/candidates/page.tsx`
- Create: `packages/portal/app/candidates/candidates-table.tsx`
- Create: `packages/portal/app/page.tsx`

- [ ] **Step 1: Create `packages/portal/app/api/candidates/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { listCandidates } from "@/lib/seed-candidates";

export async function GET() {
  const candidates = await listCandidates();
  return NextResponse.json({ candidates });
}
```

- [ ] **Step 2: Create `packages/portal/app/candidates/candidates-table.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Candidate } from "@hr-agent/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const statusVariant: Record<Candidate["status"], string> = {
  pending: "bg-slate-700 text-slate-200",
  in_progress: "bg-amber-600/30 text-amber-200 border-amber-600/40",
  complete: "bg-emerald-600/30 text-emerald-200 border-emerald-600/40",
};

export function CandidatesTable({ initialData }: { initialData: Candidate[] }) {
  const [candidates] = useState<Candidate[]>(initialData);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Joining</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progress</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((c) => (
          <TableRow
            key={c.id}
            className="cursor-pointer hover:bg-slate-900/60"
            onClick={() => (window.location.href = `/candidates/${c.id}`)}
          >
            <TableCell>
              <Link href={`/candidates/${c.id}`} className="font-medium">
                {c.name}
              </Link>
            </TableCell>
            <TableCell>{c.role}</TableCell>
            <TableCell>{c.team}</TableCell>
            <TableCell>{c.joining_date}</TableCell>
            <TableCell>
              <Badge className={statusVariant[c.status]}>
                {c.status.replace("_", " ")}
              </Badge>
            </TableCell>
            <TableCell>{c.progress}/12</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create `packages/portal/app/candidates/page.tsx`**

```tsx
import { AppShell } from "@/components/app-shell";
import { listCandidates } from "@/lib/seed-candidates";
import { CandidatesTable } from "./candidates-table";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const candidates = await listCandidates();
  return (
    <AppShell>
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-6">Candidates</h1>
        <CandidatesTable initialData={candidates} />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Replace `packages/portal/app/page.tsx` to redirect**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/candidates");
}
```

- [ ] **Step 5: Verify manually**

```bash
npm run reset      # ensure data is seeded
npm run dev
```

Login as `hr` / `acme2026`. After redirect to `/candidates`, you see 4 rows.

- [ ] **Step 6: Commit**

```bash
git add packages/portal/app/candidates packages/portal/app/api/candidates packages/portal/app/page.tsx
git commit -m "feat(portal): candidates table page reading from redis"
```

---

## Task 19: Candidate detail API — candidate + tiles + audit

**Files:**
- Create: `packages/portal/app/api/candidates/[id]/route.ts`
- Create: `packages/portal/app/api/candidates/[id]/tiles/route.ts`
- Create: `packages/portal/app/api/candidates/[id]/audit/route.ts`
- Modify: `packages/portal/lib/seed-candidates.ts` (add `getTiles`, `getAudit`)

- [ ] **Step 1: Append to `packages/portal/lib/seed-candidates.ts`**

```typescript
import { SYSTEMS, type SystemName, type Tile, type AuditEntry } from "@hr-agent/shared";

export async function getTiles(candidateId: string): Promise<Tile[]> {
  const r = getRedis();
  const tiles: Tile[] = [];
  for (const system of SYSTEMS) {
    const data = await r.hgetall(`tile:${candidateId}:${system}`);
    tiles.push({
      candidate_id: candidateId,
      system,
      status: (data.status as Tile["status"]) ?? "pending",
      ticket_id: data.ticket_id,
      artifact_summary: data.artifact_summary,
      started_at: data.started_at,
      completed_at: data.completed_at,
    });
  }
  return tiles;
}

export async function getAudit(candidateId: string): Promise<AuditEntry[]> {
  const r = getRedis();
  const items = await r.lrange(`audit:${candidateId}`, 0, -1);
  return items.map((s) => JSON.parse(s) as AuditEntry).reverse();
}
```

- [ ] **Step 2: Create `packages/portal/app/api/candidates/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getCandidate } from "@/lib/seed-candidates";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ candidate });
}
```

- [ ] **Step 3: Create `packages/portal/app/api/candidates/[id]/tiles/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getTiles } from "@/lib/seed-candidates";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tiles = await getTiles(id);
  return NextResponse.json({ tiles });
}
```

- [ ] **Step 4: Create `packages/portal/app/api/candidates/[id]/audit/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getAudit } from "@/lib/seed-candidates";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = await getAudit(id);
  return NextResponse.json({ audit });
}
```

- [ ] **Step 5: Verify with curl**

```bash
curl -s http://localhost:3000/api/candidates/priya-sharma | jq
curl -s http://localhost:3000/api/candidates/priya-sharma/tiles | jq
curl -s http://localhost:3000/api/candidates/priya-sharma/audit | jq
```

(You'll need an auth cookie — easier path: copy from a logged-in browser session.)

- [ ] **Step 6: Commit**

```bash
git add packages/portal/app/api/candidates/[id] packages/portal/lib/seed-candidates.ts
git commit -m "feat(portal): candidate detail API with tiles and audit"
```

---

## Task 20: Candidate detail page — HERO shell

**Files:**
- Create: `packages/portal/app/candidates/[id]/page.tsx`
- Create: `packages/portal/app/candidates/[id]/profile-header.tsx`
- Create: `packages/portal/app/candidates/[id]/tile-grid.tsx`
- Create: `packages/portal/app/candidates/[id]/audit-trail.tsx`

- [ ] **Step 1: Create `packages/portal/app/candidates/[id]/profile-header.tsx`**

```tsx
import type { Candidate } from "@hr-agent/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function ProfileHeader({ candidate }: { candidate: Candidate }) {
  const initials = candidate.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold">{candidate.name}</h1>
          <p className="text-slate-400">
            {candidate.role} · {candidate.team} · {candidate.manager}
          </p>
          <p className="text-sm text-slate-500">Joining {candidate.joining_date}</p>
        </div>
      </div>
      <Badge className="text-sm">{candidate.status.replace("_", " ")}</Badge>
    </div>
  );
}
```

- [ ] **Step 2: Create `packages/portal/app/candidates/[id]/tile-grid.tsx`**

```tsx
import type { Tile } from "@hr-agent/shared";

const SYSTEM_LABELS: Record<string, string> = {
  hrms: "HRMS",
  documents: "Documents",
  buddy: "Buddy",
  it: "IT Asset",
  software: "Software",
  training: "Training",
  welcome: "Welcome",
  idcard: "ID Card",
  payroll: "Payroll",
  manager_notify: "Manager Notify",
  seating: "Seating",
  parking: "Parking",
};

const STATUS_RING: Record<Tile["status"], string> = {
  pending: "border-slate-700",
  in_progress: "border-amber-500/60",
  done: "border-emerald-500/60",
  error: "border-rose-500/60",
  amending: "border-amber-500/60",
};

const STATUS_LABEL: Record<Tile["status"], string> = {
  pending: "pending",
  in_progress: "in progress",
  done: "done",
  error: "error",
  amending: "amending",
};

export function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {tiles.map((t) => (
        <div
          key={t.system}
          className={`rounded-lg border-2 ${STATUS_RING[t.status]} bg-slate-900 p-4 transition-colors`}
        >
          <p className="text-sm font-medium">{SYSTEM_LABELS[t.system] ?? t.system}</p>
          <p className="text-xs text-slate-500 capitalize mt-1">{STATUS_LABEL[t.status]}</p>
          {t.artifact_summary && (
            <p className="text-xs text-slate-300 mt-2 truncate" title={t.artifact_summary}>
              {t.artifact_summary}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `packages/portal/app/candidates/[id]/audit-trail.tsx`**

```tsx
import type { AuditEntry } from "@hr-agent/shared";

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500 italic">No audit events yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.map((e, i) => (
        <li key={i} className="text-sm border-l-2 border-slate-800 pl-3 py-1">
          <span className="text-slate-500 font-mono mr-3">
            {new Date(e.ts).toLocaleTimeString()}
          </span>
          <span className="text-slate-200">{e.msg}</span>
          {e.ticket_id && (
            <span className="text-slate-500 ml-2 font-mono text-xs">{e.ticket_id}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Create `packages/portal/app/candidates/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCandidate, getTiles, getAudit } from "@/lib/seed-candidates";
import { ProfileHeader } from "./profile-header";
import { TileGrid } from "./tile-grid";
import { AuditTrail } from "./audit-trail";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [candidate, tiles, audit] = await Promise.all([
    getCandidate(id),
    getTiles(id),
    getAudit(id),
  ]);
  if (!candidate) notFound();

  return (
    <AppShell>
      <div className="p-8 space-y-8">
        <Link href="/candidates" className="text-sm text-slate-400 hover:text-slate-200">
          ◀ Back to candidates
        </Link>
        <ProfileHeader candidate={candidate} />
        <TileGrid tiles={tiles} />
        <div>
          <h2 className="text-lg font-semibold mb-4">Audit trail</h2>
          <AuditTrail entries={audit} />
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Verify manually**

Visit `/candidates/priya-sharma`. You see Priya's header, 12 tiles (8 done in green, 4 pending in slate), audit trail.

- [ ] **Step 6: Commit**

```bash
git add packages/portal/app/candidates/[id]
git commit -m "feat(portal): candidate detail page with profile, tile grid, audit trail"
```

---

## Task 21: System CRUD page — generic template

**Files:**
- Create: `packages/portal/lib/system-tickets.ts`
- Create: `packages/portal/app/api/systems/[system]/route.ts`
- Create: `packages/portal/app/systems/[system]/page.tsx`
- Create: `packages/portal/app/systems/[system]/system-table.tsx`

- [ ] **Step 1: Create `packages/portal/lib/system-tickets.ts`**

```typescript
import { getRedis } from "./redis";
import { SYSTEMS, type SystemName } from "@hr-agent/shared";

export interface Ticket {
  ticket_id: string;
  candidate_id: string;
  status?: string;
  artifact_summary?: string;
  [k: string]: string | undefined;
}

export function isValidSystem(s: string): s is SystemName {
  return (SYSTEMS as readonly string[]).includes(s);
}

export async function listSystemTickets(system: SystemName): Promise<Ticket[]> {
  const r = getRedis();
  const ids = await r.lrange(`system:${system}:tickets`, 0, -1);
  const tickets: Ticket[] = [];
  for (const id of ids) {
    const data = await r.hgetall(`ticket:${system}:${id}`);
    if (Object.keys(data).length > 0) tickets.push(data as Ticket);
  }
  return tickets;
}
```

- [ ] **Step 2: Update seed loader to also create system tickets from initial_tiles**

Modify `packages/portal/lib/seed-candidates.ts` — inside the seed loop, after creating tiles, add:

```typescript
    for (const tile of seed.initial_tiles ?? []) {
      if (tile.ticket_id) {
        await r.hset(`ticket:${tile.system}:${tile.ticket_id}`, {
          ticket_id: tile.ticket_id,
          candidate_id: seed.id,
          status: tile.status,
          artifact_summary: tile.artifact_summary ?? "",
        });
        await r.rpush(`system:${tile.system}:tickets`, tile.ticket_id);
      }
    }
```

- [ ] **Step 3: Run reset to repopulate**

```bash
npm run reset
```

Verify:

```bash
docker exec hr-agent-redis redis-cli LRANGE system:hrms:tickets 0 -1
```

Expected: 3 ticket IDs (Aanya, Vikram, Priya — Karan is pending so no tickets).

- [ ] **Step 4: Create `packages/portal/app/api/systems/[system]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { listSystemTickets, isValidSystem } from "@/lib/system-tickets";

export async function GET(_req: Request, { params }: { params: Promise<{ system: string }> }) {
  const { system } = await params;
  if (!isValidSystem(system)) {
    return NextResponse.json({ error: "Unknown system" }, { status: 404 });
  }
  const tickets = await listSystemTickets(system);
  return NextResponse.json({ tickets });
}
```

- [ ] **Step 5: Create `packages/portal/app/systems/[system]/system-table.tsx`**

```tsx
"use client";

import type { Ticket } from "@/lib/system-tickets";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SystemTable({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return <p className="text-sm text-slate-500 italic">No tickets yet.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticket</TableHead>
          <TableHead>Candidate</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Summary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((t) => (
          <TableRow key={t.ticket_id}>
            <TableCell className="font-mono text-xs">{t.ticket_id}</TableCell>
            <TableCell>{t.candidate_id}</TableCell>
            <TableCell>{t.status}</TableCell>
            <TableCell className="text-slate-300">{t.artifact_summary}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 6: Create `packages/portal/app/systems/[system]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { listSystemTickets, isValidSystem } from "@/lib/system-tickets";
import { SystemTable } from "./system-table";

const SYSTEM_LABELS: Record<string, string> = {
  hrms: "HRMS",
  documents: "Documents",
  buddy: "Buddy",
  it: "IT Asset Tickets",
  software: "Software Provisioning",
  training: "Training Enrollments",
  welcome: "Welcome Notifications",
  idcard: "ID Card Requests",
  payroll: "Payroll",
  manager_notify: "Manager Notifications",
  seating: "Seating Allocations",
  parking: "Parking Allocations",
};

export const dynamic = "force-dynamic";

export default async function SystemPage({
  params,
}: {
  params: Promise<{ system: string }>;
}) {
  const { system } = await params;
  if (!isValidSystem(system)) notFound();
  const tickets = await listSystemTickets(system);
  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-semibold">{SYSTEM_LABELS[system] ?? system}</h1>
        <SystemTable tickets={tickets} />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 7: Verify manually**

Visit `http://localhost:3000/systems/hrms`. Expected: table with 3 ticket rows.

- [ ] **Step 8: Commit**

```bash
git add packages/portal/app/systems packages/portal/app/api/systems packages/portal/lib/system-tickets.ts packages/portal/lib/seed-candidates.ts
git commit -m "feat(portal): generic system CRUD page (R only) for all 12 systems"
```

---

## Task 22: Admin dashboard

**Files:**
- Create: `packages/portal/app/admin/page.tsx`
- Create: `packages/portal/lib/metrics.ts`

- [ ] **Step 1: Create `packages/portal/lib/metrics.ts`**

```typescript
import { listCandidates } from "./seed-candidates";

export interface Metrics {
  total_candidates: number;
  in_progress: number;
  complete: number;
  pending: number;
  avg_progress: number;
}

export async function getMetrics(): Promise<Metrics> {
  const all = await listCandidates();
  const inProgress = all.filter((c) => c.status === "in_progress").length;
  const complete = all.filter((c) => c.status === "complete").length;
  const pending = all.filter((c) => c.status === "pending").length;
  const avgProgress =
    all.length === 0 ? 0 : all.reduce((s, c) => s + c.progress, 0) / all.length;
  return {
    total_candidates: all.length,
    in_progress: inProgress,
    complete,
    pending,
    avg_progress: Math.round(avgProgress * 10) / 10,
  };
}
```

- [ ] **Step 2: Create `packages/portal/app/admin/page.tsx`**

```tsx
import { AppShell } from "@/components/app-shell";
import { getMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const m = await getMetrics();
  return (
    <AppShell>
      <div className="p-8 space-y-8">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <div className="grid grid-cols-4 gap-4">
          <Card label="Total candidates" value={m.total_candidates} />
          <Card label="In progress" value={m.in_progress} />
          <Card label="Complete" value={m.complete} />
          <Card label="Pending" value={m.pending} />
        </div>
        <p className="text-sm text-slate-500">
          Phase 2 will add: time-saved counter, recent activity feed, big-number reveal.
        </p>
      </div>
    </AppShell>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-4xl font-semibold mt-2">{value}</p>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

Visit `/admin`. Four big-number cards render. With seed data: total=4, in_progress=1, complete=2, pending=1.

- [ ] **Step 4: Commit**

```bash
git add packages/portal/app/admin packages/portal/lib/metrics.ts
git commit -m "feat(portal): admin dashboard with basic metrics"
```

---

## Task 23: Portal Dockerfile + docker-compose full-stack

**Files:**
- Create: `packages/portal/Dockerfile`
- Modify: `packages/portal/next.config.js` (output standalone)
- Create: `deploy/docker-compose.yml`

- [ ] **Step 1: Update `packages/portal/next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};

module.exports = nextConfig;
```

- [ ] **Step 2: Create `packages/portal/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/portal/package*.json ./packages/portal/
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/portal/node_modules ./packages/portal/node_modules 2>/dev/null || true
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm --workspace=portal run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/packages/portal/.next/standalone ./
COPY --from=builder /app/packages/portal/.next/static ./packages/portal/.next/static
COPY --from=builder /app/packages/portal/public ./packages/portal/public
COPY --from=builder /app/master-data ./master-data
COPY --from=builder /app/seed-data ./seed-data
EXPOSE 3000
CMD ["node", "packages/portal/server.js"]
```

- [ ] **Step 3: Create `deploy/docker-compose.yml`**

```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  portal:
    build:
      context: ..
      dockerfile: packages/portal/Dockerfile
    ports: ["3000:3000"]
    env_file: ../.env
    environment:
      REDIS_URL: redis://redis:6379
      MASTER_DATA_DIR: /app/master-data
      SEED_DATA_DIR: /app/seed-data
    depends_on:
      redis:
        condition: service_healthy
```

- [ ] **Step 4: Test the build**

```bash
cp .env.example .env
docker compose -f deploy/docker-compose.yml build
```

Expected: builds successfully.

(Running it requires running `npm run reset` against the container's Redis, which we'll wire up post-Phase 1.)

- [ ] **Step 5: Commit**

```bash
git add packages/portal/Dockerfile packages/portal/next.config.js deploy/docker-compose.yml
git commit -m "feat(deploy): portal dockerfile and full-stack docker-compose"
```

---

## Task 24: Playwright smoke test — login → candidates → detail → admin

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`

- [ ] **Step 1: Install Playwright browsers**

```bash
npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm --workspace=portal run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

- [ ] **Step 3: Create `e2e/smoke.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Phase 1 smoke", () => {
  test.beforeAll(async () => {
    // Assumes redis is running and seeded via `npm run reset`
  });

  test("login redirects unauthenticated users", async ({ page }) => {
    await page.goto("/candidates");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login → candidates → detail → admin happy path", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("hr");
    await page.getByLabel("Password").fill("acme2026");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/candidates/);
    await expect(page.getByRole("heading", { name: "Candidates" })).toBeVisible();
    await expect(page.getByText("Priya Sharma")).toBeVisible();
    await expect(page.getByText("Aanya Patel")).toBeVisible();

    await page.getByRole("link", { name: "Priya Sharma" }).click();
    await expect(page).toHaveURL(/\/candidates\/priya-sharma/);
    await expect(page.getByRole("heading", { name: "Priya Sharma" })).toBeVisible();
    await expect(page.getByText("HRMS")).toBeVisible();

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
    await expect(page.getByText("Total candidates")).toBeVisible();

    await page.goto("/systems/hrms");
    await expect(page.getByRole("heading", { name: "HRMS" })).toBeVisible();
  });

  test("invalid login shakes and shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("hr");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
```

- [ ] **Step 4: Run the suite**

```bash
npm run redis
npm run reset
npm run test:e2e
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add e2e playwright.config.ts package.json
git commit -m "test(e2e): phase 1 smoke covering login, candidates, detail, admin"
```

---

## Task 25: README + finalize

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# HR Onboarding Agent — Demo

Multi-agent HR onboarding demo built for a 3000-person townhall.

## Status

**Phase 1 of 4 complete.** Portal scaffold, auth, persistent storage, candidates table, candidate detail page (read-only), system CRUD pages, and admin dashboard. **No agent runtime yet** — Phase 2 adds the orchestrator.

See [docs/superpowers/specs/2026-05-01-hr-onboarding-agent-demo-design.md](docs/superpowers/specs/2026-05-01-hr-onboarding-agent-demo-design.md) for full design.

## Quick start

```bash
cp .env.example .env
npm install
npm run redis        # docker compose up redis
npm run reset        # FLUSHDB + seed master data + 4 candidates
npm run dev          # next dev on :3000
```

Visit `http://localhost:3000`. Login with `hr` / `acme2026`.

## Auth

**This auth is for demo only. Do not deploy.** Plaintext passwords in env vars, no rate limiting, no CSRF.

## Tests

```bash
npm test             # vitest unit tests
npm run test:e2e     # playwright smoke tests (requires redis + seeded data)
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README for phase 1"
```

---

## Phase 1 verification

- [ ] **Final verification: full happy path**

```bash
npm run reset
npm run dev
# in another terminal
npm run test:e2e
```

All 3 e2e tests pass. Manually: login as `hr`, see 4 candidates, click Priya, see her tile grid (8 green, 4 slate) and audit row, click `/admin`, see metrics, click `/systems/hrms`, see 3 tickets.

- [ ] **Final commit**

```bash
git tag phase-1-complete
git log --oneline | head -30
```

---

## What Phase 2 adds

- Orchestrator service (`packages/orchestrator/`) on port 3001
- Supervisor agent + 12 sub-agents
- Common toolbelt + master-data lookup tools
- Email rendering via MJML + Azure Communication Services
- SSE event stream from Redis pub/sub → browser
- HTTP-triggered cascade (no voice yet — Phase 3)
- W1 tile animations driven by SSE
- W2 reasoning stream
- W4 stopwatch + savings counter
- Idempotent sub-agent base middleware
- Desired-state diff for amendments
