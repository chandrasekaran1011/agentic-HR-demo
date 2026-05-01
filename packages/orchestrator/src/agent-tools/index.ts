import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Candidate } from "@hr-agent/shared";
import { getRedis } from "../lib/redis";
import { runOnboarding, amendOnboarding } from "../supervisor/run-cascade";

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_status",
      description: "Look up the onboarding status of an existing candidate by name or employee ID. Use when HR asks 'what's the status of X' or 'how is Y's onboarding going'.",
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
      description: "Begin the autonomous onboarding cascade for a NEW joiner. Use when HR asks to onboard, set up, or kick off for a new employee. Confirm details back before calling.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name" },
          email: { type: "string", description: "Email address; if not given derive as firstname.lastname@<company-domain>" },
          role: { type: "string", description: "Job title (e.g. 'Senior Backend Engineer')" },
          team: { type: "string", description: "Team name (e.g. 'AI Platform')" },
          manager: { type: "string", description: "Manager full name" },
          joining_date: { type: "string", description: "ISO date YYYY-MM-DD" },
          current_city: { type: "string", description: "Current city — used to detect relocation. Optional." },
        },
        required: ["name", "role", "team", "joining_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "amend_onboarding",
      description: "Modify an existing candidate's onboarding when HR corrects role, team, manager, joining date, or email. Re-runs only affected systems.",
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
  const msg = `${c.name} is ${c.status}. ${done} of 12 actions complete.${pending.length ? " Pending: " + pending.join(", ") + "." : ""}`;
  return { ok: true, message: msg, data: { id: c.id, progress: done, status: c.status } };
}

interface StartOnboardingArgs {
  name: string;
  email?: string;
  role: string;
  team: string;
  manager?: string;
  joining_date: string;
  current_city?: string;
}

async function startOnboarding(args: StartOnboardingArgs): Promise<ToolResult> {
  if (!args.name || !args.role || !args.team || !args.joining_date) {
    return { ok: false, message: "Missing required fields. Need name, role, team, joining_date." };
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

  // Fire and forget
  runOnboarding(candidate).catch((err) => console.error("[start_onboarding]", err));

  return {
    ok: true,
    message: `Started onboarding for ${args.name} (${args.role}, ${args.team}, joining ${args.joining_date}). Twelve actions in progress — watch the candidate page.`,
    data: { candidate_id: id },
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
