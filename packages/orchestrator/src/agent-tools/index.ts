import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Candidate, SystemName } from "@hr-agent/shared";
import { SYSTEMS } from "@hr-agent/shared";
import { getRedis } from "../lib/redis";
import { runOnboarding, amendOnboarding, runSingleSystem } from "../supervisor/run-cascade";

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_pending_candidates",
      description:
        "List candidates that have been handed over from the Applicant Tracking System (ATS) and are awaiting onboarding. Use this first if the user asks 'who needs onboarding' / 'what's pending' / 'show me the queue', OR before calling start_onboarding to confirm the candidate is already in the system.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_status",
      description:
        "Look up the onboarding status of an existing candidate by name or employee ID. Use when HR asks 'what's the status of X' or 'how is Y's onboarding going'.",
      parameters: {
        type: "object",
        properties: {
          name_or_id: {
            type: "string",
            description: "The candidate's full name or employee ID (e.g. 'Jessica Cohen' or 'jessica-cohen')",
          },
        },
        required: ["name_or_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_onboarding",
      description:
        "Trigger the autonomous onboarding cascade for a candidate. Most candidates are already in the system from ATS — call this with just `name_or_id` and the agent will use the ATS-supplied role, team, manager, and joining date. The first action is the document-upload request for background verification, then the rest run in parallel. Only provide role/team/manager/joining_date for ad-hoc onboarding of someone NOT already in ATS.",
      parameters: {
        type: "object",
        properties: {
          name_or_id: {
            type: "string",
            description: "Candidate's full name or ID (matches ATS-provided record).",
          },
          role: { type: "string", description: "ONLY for ad-hoc joiners not in ATS." },
          team: { type: "string", description: "ONLY for ad-hoc joiners not in ATS." },
          manager: { type: "string", description: "ONLY for ad-hoc joiners not in ATS." },
          joining_date: { type: "string", description: "ISO YYYY-MM-DD. ONLY for ad-hoc joiners not in ATS." },
          email: { type: "string", description: "Optional override; otherwise derived." },
          current_city: { type: "string", description: "Optional; used to detect relocation." },
        },
        required: ["name_or_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "amend_onboarding",
      description:
        "Modify an existing candidate's onboarding when HR corrects role, team, manager, joining date, or email. Re-runs only the affected systems.",
      parameters: {
        type: "object",
        properties: {
          name_or_id: { type: "string", description: "Candidate name or ID" },
          changes: {
            type: "object",
            properties: {
              role: { type: "string" },
              team: { type: "string" },
              manager: { type: "string" },
              joining_date: { type: "string" },
              email: { type: "string" },
            },
          },
        },
        required: ["name_or_id", "changes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_single_step",
      description:
        "Re-run ONE specific system step for a candidate. Use this when HR asks for an individual action — e.g. 'request the ID card again', 'resend the welcome email', 'redo just the IT request', 'apply for parking', 'kick off training again'. The 12 systems are: hrms, documents, buddy, it, software, training, welcome, idcard, payroll, manager_notify, seating, parking. Pick the one that best matches HR's request.",
      parameters: {
        type: "object",
        properties: {
          name_or_id: { type: "string", description: "Candidate name or ID" },
          system: {
            type: "string",
            enum: [
              "hrms", "documents", "buddy", "it", "software", "training",
              "welcome", "idcard", "payroll", "manager_notify", "seating", "parking",
            ],
            description: "Which system step to re-run",
          },
        },
        required: ["name_or_id", "system"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reassign_buddy",
      description:
        "Assign a SPECIFIC buddy to a candidate (overrides the agent's automatic pick). Use when HR names a particular person, e.g. 'make Daniel Garcia his buddy' or 'reassign Tyler's buddy to aisha@acme.com'. The buddy must be in the candidate's team buddy pool.",
      parameters: {
        type: "object",
        properties: {
          name_or_id: { type: "string", description: "Candidate name or ID" },
          buddy: {
            type: "string",
            description:
              "Buddy email (preferred) or full name. Must match someone in the candidate's team buddy pool.",
          },
        },
        required: ["name_or_id", "buddy"],
      },
    },
  },
];

export interface ToolResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

export async function executeToolCall(name: string, argsJson: string): Promise<ToolResult> {
  const args = JSON.parse(argsJson || "{}");
  switch (name) {
    case "list_pending_candidates":
      return listPending();
    case "lookup_status":
      return lookupStatus(args.name_or_id);
    case "start_onboarding":
      return startOnboarding(args);
    case "amend_onboarding":
      return amendOnboardingTool(args.name_or_id, args.changes);
    case "run_single_step":
      return runSingleStep(args.name_or_id, args.system);
    case "reassign_buddy":
      return reassignBuddy(args.name_or_id, args.buddy);
    default:
      return { ok: false, message: `unknown tool: ${name}` };
  }
}

const SYSTEM_LABEL: Record<string, string> = {
  hrms: "HRMS record",
  documents: "document checklist",
  buddy: "buddy assignment",
  it: "IT laptop request",
  software: "software entitlements",
  training: "training enrollment",
  welcome: "welcome email",
  idcard: "ID card",
  payroll: "payroll setup",
  manager_notify: "manager notification",
  seating: "seating allocation",
  parking: "parking allocation",
};

async function runSingleStep(nameOrId: string, system: string): Promise<ToolResult> {
  if (!(SYSTEMS as readonly string[]).includes(system)) {
    return { ok: false, message: `Unknown system "${system}". Valid: ${SYSTEMS.join(", ")}.` };
  }
  const c = await findCandidateByNameOrId(nameOrId);
  if (!c?.id) return { ok: false, message: `No candidate found matching "${nameOrId}".` };
  try {
    const result = await runSingleSystem(c.id, system as SystemName);
    return {
      ok: true,
      message: `Re-ran ${SYSTEM_LABEL[system] ?? system} for ${c.name}. Run id: ${result.run_id}.`,
      data: { candidate_id: c.id, system, ...result },
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

async function reassignBuddy(nameOrId: string, buddy: string): Promise<ToolResult> {
  const c = await findCandidateByNameOrId(nameOrId);
  if (!c?.id) return { ok: false, message: `No candidate found matching "${nameOrId}".` };
  const override = buddy.includes("@") ? { buddy_email: buddy } : { buddy_name: buddy };
  try {
    const result = await runSingleSystem(c.id, "buddy", override);
    return {
      ok: true,
      message: `Re-assigned ${c.name}'s buddy to "${buddy}". Run id: ${result.run_id}.`,
      data: { candidate_id: c.id, ...result },
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

async function listPending(): Promise<ToolResult> {
  const r = getRedis();
  const ids = await r.smembers("candidates:active");
  const pending: Array<Record<string, string>> = [];
  for (const id of ids) {
    const c = await r.hgetall(`candidate:${id}`);
    if (c.status === "pending") pending.push(c);
  }
  if (pending.length === 0) {
    return { ok: true, message: "No candidates currently waiting for onboarding from ATS." };
  }
  const summary = pending
    .map((c) => `• ${c.name} — ${c.role}, ${c.team}, joining ${c.joining_date} (manager: ${c.manager})`)
    .join("\n");
  return {
    ok: true,
    message: `${pending.length} candidate(s) handed over from ATS, awaiting onboarding:\n${summary}`,
    data: { count: pending.length, candidates: pending },
  };
}

async function findCandidateByNameOrId(nameOrId: string): Promise<Record<string, string> | null> {
  const r = getRedis();
  let c = await r.hgetall(`candidate:${nameOrId}`);
  if (c.id) return c;
  const ids = await r.smembers("candidates:active");
  for (const cid of ids) {
    const cc = await r.hgetall(`candidate:${cid}`);
    if (cc.name && cc.name.toLowerCase().includes(nameOrId.toLowerCase())) return cc;
  }
  return null;
}

// Human-readable label for each system tile, used in the lookup_status reply.
const SYSTEM_LABELS: Record<string, string> = {
  hrms: "HRMS",
  documents: "Documents",
  buddy: "Buddy",
  it: "IT (laptop)",
  software: "Software entitlements",
  training: "Training enrollments",
  welcome: "Welcome email",
  idcard: "ID card",
  payroll: "Payroll",
  manager_notify: "Manager notification",
  seating: "Seating",
  parking: "Parking",
};

const ALL_SYSTEMS = [
  "hrms", "documents", "buddy", "it", "software", "training",
  "welcome", "idcard", "payroll", "manager_notify", "seating", "parking",
];

interface TileDetail {
  system: string;
  label: string;
  status: string;
  ticket_id?: string;
  artifact_summary?: string;
  details: Record<string, string>; // full ticket record
}

async function readTileWithTicket(candidateId: string, system: string): Promise<TileDetail> {
  const r = getRedis();
  const tile = await r.hgetall(`tile:${candidateId}:${system}`);
  const detail: TileDetail = {
    system,
    label: SYSTEM_LABELS[system] ?? system,
    status: tile.status ?? "pending",
    ticket_id: tile.ticket_id,
    artifact_summary: tile.artifact_summary,
    details: {},
  };
  if (tile.ticket_id) {
    const ticket = await r.hgetall(`ticket:${system}:${tile.ticket_id}`);
    detail.details = ticket;
  }
  return detail;
}

async function lookupStatus(nameOrId: string): Promise<ToolResult> {
  const c = await findCandidateByNameOrId(nameOrId);
  if (!c) return { ok: false, message: `No candidate found matching "${nameOrId}".` };

  const tiles: TileDetail[] = [];
  let done = 0;
  const pending: string[] = [];
  const candidateId = c.id ?? "";
  for (const s of ALL_SYSTEMS) {
    const t = await readTileWithTicket(candidateId, s);
    tiles.push(t);
    if (t.status === "done") done++;
    else if (t.status !== "amending") pending.push(t.label);
  }

  // ── Build a rich, agent-readable breakdown ──────────────────────
  // The agent sees this entire blob and uses it to answer follow-ups
  // ("where is she posted?", "what laptop?", "who's her buddy?", etc.).
  const profileLine = `Role: ${c.role ?? "—"} · Team: ${c.team ?? "—"} · Manager: ${c.manager ?? "—"} · Joining: ${c.joining_date ?? "—"}${c.current_city ? ` · Currently in: ${c.current_city}` : ""}${c.email ? ` · Work email: ${c.email}` : ""}`;
  const statusLine = `${c.name} — ${c.status}, ${done}/12 actions complete${pending.length ? `; pending: ${pending.join(", ")}` : ""}.`;

  const breakdownLines: string[] = [];
  for (const t of tiles) {
    const parts: string[] = [];
    parts.push(`• ${t.label}: ${t.status}`);
    if (t.ticket_id) parts.push(`(${t.ticket_id})`);
    if (t.artifact_summary) parts.push(`— ${t.artifact_summary}`);
    // Add a few system-specific high-value fields so the agent has them.
    const d = t.details;
    if (t.system === "it") {
      const it: string[] = [];
      if (d.laptop_model) it.push(d.laptop_model);
      if (d.ram) it.push(d.ram);
      if (d.cpu) it.push(d.cpu);
      if (d.accessories) it.push(`accessories: ${d.accessories}`);
      if (d.status) it.push(`shipping: ${d.status}`);
      if (it.length) parts.push(`{${it.join(", ")}}`);
    }
    if (t.system === "software" && d.entitlements) parts.push(`{${d.entitlements}}`);
    if (t.system === "training") {
      const tr: string[] = [];
      if (d.required) tr.push(`required: ${d.required}`);
      if (d.recommended) tr.push(`recommended: ${d.recommended}`);
      if (tr.length) parts.push(`{${tr.join("; ")}}`);
    }
    if (t.system === "buddy" && (d.buddy_name || d.buddy_email)) {
      const bp: string[] = [];
      if (d.buddy_name) bp.push(d.buddy_name);
      if (d.buddy_email) bp.push(d.buddy_email);
      parts.push(`{${bp.join(", ")}}`);
    }
    if (t.system === "seating") {
      const seat: string[] = [];
      if (d.floor) seat.push(`floor ${d.floor}`);
      if (d.wing) seat.push(`${d.wing} wing`);
      if (d.desk_code) seat.push(`desk ${d.desk_code}`);
      if (seat.length) parts.push(`{${seat.join(", ")}}`);
    }
    if (t.system === "parking" && d.slot) parts.push(`{slot ${d.slot}${d.vehicle_type ? `, ${d.vehicle_type}` : ""}}`);
    if (t.system === "payroll" && d.band) parts.push(`{band ${d.band}}`);
    if (t.system === "manager_notify" && d.manager_email) parts.push(`{notified ${d.manager_email}}`);
    if (t.system === "welcome" && d.recipients) parts.push(`{to ${d.recipients}}`);
    if (t.system === "documents" && d.documents) parts.push(`{checklist: ${d.documents}}`);
    breakdownLines.push(parts.join(" "));
  }

  return {
    ok: true,
    message: [statusLine, profileLine, "", ...breakdownLines].join("\n"),
    data: {
      id: c.id,
      name: c.name,
      role: c.role,
      team: c.team,
      manager: c.manager,
      email: c.email,
      joining_date: c.joining_date,
      current_city: c.current_city,
      progress: done,
      status: c.status,
      pending_systems: pending,
      tiles,
    },
  };
}

interface StartOnboardingArgs {
  name_or_id?: string;
  // Legacy / ad-hoc fields for joiners not in ATS
  name?: string;
  email?: string;
  role?: string;
  team?: string;
  manager?: string;
  joining_date?: string;
  current_city?: string;
}

async function startOnboarding(args: StartOnboardingArgs): Promise<ToolResult> {
  // Path 1: candidate is already in the system (handed over from ATS).
  // We accept either name_or_id or name as the lookup key.
  const lookupKey = args.name_or_id ?? args.name;
  if (lookupKey) {
    const existing = await findCandidateByNameOrId(lookupKey);
    if (existing && existing.id) {
      const candidate: Candidate = {
        id: existing.id,
        name: existing.name ?? "",
        email: args.email ?? existing.email ?? "",
        role: existing.role ?? "",
        team: existing.team ?? "",
        manager: existing.manager ?? "",
        joining_date: existing.joining_date ?? "",
        current_city: args.current_city ?? existing.current_city,
        status: "in_progress",
        progress: 0,
        photo_url: existing.photo_url ?? "/avatars/default-male.png",
        created_at: existing.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      runOnboarding(candidate).catch((err) =>
        console.error("[start_onboarding]", err)
      );
      return {
        ok: true,
        message: `Started onboarding for ${candidate.name} (${candidate.role}, ${candidate.team}, joining ${candidate.joining_date}). Background-verification document request goes out first; the rest run in parallel. Watch the candidate page.`,
        data: { candidate_id: candidate.id, source: "ats" },
      };
    }
  }

  // Path 2: ad-hoc onboarding (joiner not in ATS). Need full details.
  if (!args.name || !args.role || !args.team || !args.joining_date) {
    return {
      ok: false,
      message:
        "Candidate not found in ATS. To create an ad-hoc onboarding I need name, role, team, and joining_date.",
    };
  }
  const id = args.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const domain = process.env.COMPANY_DOMAIN ?? "acme.com";
  const email = args.email ?? `${id.replace("-", ".")}@${domain}`;
  const candidate: Candidate = {
    id,
    name: args.name,
    email,
    role: args.role,
    team: args.team,
    manager: args.manager ?? "TBD",
    joining_date: args.joining_date,
    current_city: args.current_city,
    status: "in_progress",
    progress: 0,
    photo_url: "/avatars/default-male.png",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  runOnboarding(candidate).catch((err) => console.error("[start_onboarding]", err));
  return {
    ok: true,
    message: `Started ad-hoc onboarding for ${args.name} (${args.role}, ${args.team}, joining ${args.joining_date}). Background-verification document request goes out first; the rest run in parallel.`,
    data: { candidate_id: id, source: "ad-hoc" },
  };
}

async function amendOnboardingTool(
  nameOrId: string,
  changes: Partial<Candidate>
): Promise<ToolResult> {
  const c = await findCandidateByNameOrId(nameOrId);
  if (!c) return { ok: false, message: `No candidate found matching "${nameOrId}".` };
  const candidate: Candidate = {
    id: c.id ?? "",
    name: c.name ?? "",
    email: c.email ?? "",
    role: c.role ?? "",
    team: c.team ?? "",
    manager: c.manager ?? "",
    joining_date: c.joining_date ?? "",
    current_city: c.current_city,
    status: (c.status as Candidate["status"]) ?? "in_progress",
    progress: parseInt(c.progress ?? "0", 10),
    photo_url: c.photo_url ?? "",
    created_at: c.created_at ?? "",
    updated_at: c.updated_at ?? "",
  };

  const result = await amendOnboarding(candidate, changes as Partial<Pick<Candidate, "role" | "team" | "manager" | "joining_date" | "email">>);
  return {
    ok: true,
    message: `Updated ${c.name}. Re-ran ${result.affected.length} affected systems: ${result.affected.join(", ")}.`,
    data: result,
  };
}
