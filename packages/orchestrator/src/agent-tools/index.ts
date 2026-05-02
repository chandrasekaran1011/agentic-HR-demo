import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Candidate } from "@hr-agent/shared";
import { getRedis } from "../lib/redis";
import { runOnboarding, amendOnboarding } from "../supervisor/run-cascade";

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
            description: "The candidate's full name or employee ID (e.g. 'Priya Sharma' or 'priya-sharma')",
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
    default:
      return { ok: false, message: `unknown tool: ${name}` };
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

async function lookupStatus(nameOrId: string): Promise<ToolResult> {
  const c = await findCandidateByNameOrId(nameOrId);
  if (!c) return { ok: false, message: `No candidate found matching "${nameOrId}".` };

  const SYSTEMS = ["hrms", "documents", "buddy", "it", "software", "training", "welcome", "idcard", "payroll", "manager_notify", "seating", "parking"];
  let done = 0;
  const pending: string[] = [];
  const r = getRedis();
  for (const s of SYSTEMS) {
    const status = await r.hget(`tile:${c.id}:${s}`, "status");
    if (status === "done") done++;
    else if (status !== "amending") pending.push(s);
  }

  // Include the work-relevant org-chart fields HR needs every time they ask.
  // Salary band, personal phone, govt IDs etc. are intentionally NOT here.
  const profileLine = `Role: ${c.role ?? "—"} · Team: ${c.team ?? "—"} · Manager: ${c.manager ?? "—"} · Joining: ${c.joining_date ?? "—"}${c.email ? ` · Work email: ${c.email}` : ""}`;
  const statusLine = `${c.name} — ${c.status}, ${done}/12 actions complete${pending.length ? `; pending: ${pending.join(", ")}` : ""}.`;

  return {
    ok: true,
    message: `${statusLine}\n${profileLine}`,
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
