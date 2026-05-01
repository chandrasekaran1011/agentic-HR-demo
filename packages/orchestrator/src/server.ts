import Fastify from "fastify";
import { z } from "zod";
import type { Candidate } from "@hr-agent/shared";
import { runOnboarding, amendOnboarding } from "./supervisor/run-cascade";
import { getRedis } from "./lib/redis";
import { AGENT_TOOLS, executeToolCall } from "./agent-tools/index.js";
import { runAgentTurn, readRealtimeConfig } from "./llm/azure-openai";
import type { AgentInputItem } from "./llm/azure-openai";
import { getCompany } from "./lib/company";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

app.get("/health", async () => ({ ok: true }));

const RunBodySchema = z.object({
  candidate: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    role: z.string(),
    team: z.string(),
    manager: z.string(),
    joining_date: z.string(),
    current_city: z.string().optional(),
    photo_url: z.string().optional(),
  }),
});

app.post("/run", async (req, reply) => {
  const parsed = RunBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
  }
  const c = parsed.data.candidate;
  const candidate: Candidate = {
    id: c.id,
    name: c.name,
    email: c.email,
    role: c.role,
    team: c.team,
    manager: c.manager,
    joining_date: c.joining_date,
    current_city: c.current_city,
    status: "in_progress",
    progress: 0,
    photo_url: c.photo_url ?? "/avatars/default-male.png",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  // fire-and-forget
  runOnboarding(candidate).catch((err) => app.log.error({ err }, "runOnboarding failed"));
  return { ok: true, candidate_id: candidate.id };
});

const AmendBodySchema = z.object({
  candidate_id: z.string(),
  changes: z.object({
    role: z.string().optional(),
    team: z.string().optional(),
    manager: z.string().optional(),
    joining_date: z.string().optional(),
    email: z.string().email().optional(),
  }),
});

app.post("/amend", async (req, reply) => {
  const parsed = AmendBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
  }
  const r = getRedis();
  const c = await r.hgetall(`candidate:${parsed.data.candidate_id}`);
  if (!c.id) return reply.code(404).send({ error: "candidate not found" });
  const candidate: Candidate = {
    id: c.id,
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
  // fire-and-forget
  amendOnboarding(candidate, parsed.data.changes).catch((err) =>
    app.log.error({ err }, "amendOnboarding failed")
  );
  return { ok: true, candidate_id: candidate.id };
});

const LookupBodySchema = z.object({ name_or_id: z.string() });

app.post("/lookup", async (req, reply) => {
  const parsed = LookupBodySchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid body" });
  const r = getRedis();
  const id = parsed.data.name_or_id;
  // Try direct id match first
  let c = await r.hgetall(`candidate:${id}`);
  if (!c.id) {
    // Search by name (slow but small dataset)
    const ids = await r.smembers("candidates:active");
    for (const cid of ids) {
      const cc = await r.hgetall(`candidate:${cid}`);
      if (cc.name && cc.name.toLowerCase().includes(id.toLowerCase())) {
        c = cc;
        break;
      }
    }
  }
  if (!c.id) return reply.code(404).send({ error: "not found" });

  // Count tile statuses
  const SYSTEMS = ["hrms", "documents", "buddy", "it", "software", "training", "welcome", "idcard", "payroll", "manager_notify", "seating", "parking"];
  let done = 0;
  const pendingNames: string[] = [];
  for (const s of SYSTEMS) {
    const status = await r.hget(`tile:${c.id}:${s}`, "status");
    if (status === "done") done++;
    else if (status !== "done" && status !== "amending") pendingNames.push(s);
  }
  const summary = `${c.name} is ${c.status}. ${done} of 12 actions complete. Pending: ${pendingNames.join(", ") || "none"}.`;
  return { candidate_id: c.id, summary, progress: done, status: c.status };
});

// ─── Chat (text agent shared with voice) ─────────────────────────

// ─── Voice persona: Sara ─────────────────────────────────────────

function voiceSystemPrompt(): string {
  const c = getCompany();
  return `You are Sara, the HR Onboarding Voice Assistant for ${c.name}.

When the conversation starts, greet the user warmly with EXACTLY this opening line:
"Hi, I'm Sara, your onboarding assistant. How can I help you today?"

After greeting, listen and help. You have three tools:
  - lookup_status(name_or_id) — to answer status questions
  - start_onboarding(...) — to begin a new joiner onboarding
  - amend_onboarding(name, changes) — to modify an existing onboarding

Style: warm, professional, brief. Speak in clear English. Office is in ${c.officeCity}.
Today's date is ${new Date().toISOString().slice(0, 10)}.

Confirm key details (name, role, team, joining date) back to the user BEFORE calling start_onboarding.
When tools succeed, summarize the result in one short sentence.
On "thank you" / "goodbye", reply briefly and warmly. Do not invent further actions.`;
}

function chatSystemPrompt(): string {
  const c = getCompany();
  return `You are the HR Onboarding Agent for ${c.name}.

You have THREE tools:
  - lookup_status(name_or_id) — answer status questions
  - start_onboarding(...)     — kick off the autonomous cascade
  - amend_onboarding(name, changes) — modify an existing onboarding

Style: warm, concise, professional. No filler. Confirm key details (name, role, team, date) before calling start_onboarding. Speak in plain English. Office is in ${c.officeCity}.

Today's date is ${new Date().toISOString().slice(0, 10)}.

When tools succeed, summarize what happened in one short sentence.`;
}

const ChatBodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

const AGENT_TOOL_SPECS = AGENT_TOOLS.map((t) => ({
  name: t.function.name,
  description: t.function.description ?? "",
  parameters: t.function.parameters as Record<string, unknown>,
}));

app.post("/chat", async (req, reply) => {
  const parsed = ChatBodySchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid body" });

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  const send = (obj: unknown) => {
    reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  // Build Responses API input: system instructions as first message, then history
  const input: AgentInputItem[] = [
    { role: "system", content: chatSystemPrompt() },
    ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content }) as AgentInputItem),
  ];

  const MAX_ITERATIONS = 5;
  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const turn = await runAgentTurn(input, AGENT_TOOL_SPECS);
      if (turn.text) send({ type: "delta", text: turn.text });

      // No tool calls? we're done.
      if (turn.toolCalls.length === 0) {
        if (turn.text) {
          input.push({ role: "assistant", content: turn.text });
        }
        break;
      }

      // Append the model's tool calls to the conversation history
      for (const tc of turn.toolCalls) {
        send({ type: "tool_call", id: tc.call_id, name: tc.name, args: tc.arguments });
        input.push(tc);
      }

      // Execute each tool, then append the outputs
      for (const tc of turn.toolCalls) {
        const result = await executeToolCall(tc.name, tc.arguments);
        send({ type: "tool_result", id: tc.call_id, result });
        input.push({
          type: "function_call_output",
          call_id: tc.call_id,
          output: JSON.stringify(result),
        });
      }
    }
  } catch (err) {
    const e = err as { message?: string; status?: number; error?: { message?: string } };
    const errorText = e?.error?.message || e?.message || "LLM call failed";
    app.log.error({ err }, "/chat LLM error");
    send({ type: "error", message: errorText });
  }

  send({ type: "done" });
  reply.raw.end();
  return reply;
});

// ─── Voice session minting ───────────────────────────────────────

app.get("/voice/session", async (_req, reply) => {
  // Realtime config is independent from chat — different endpoint/key/version
  // common when chat and realtime live on different Azure AI Foundry resources.
  const cfg = readRealtimeConfig();
  if (!cfg) {
    return reply.send({
      mock: true,
      message:
        "Voice mock mode — set AZURE_OPENAI_REALTIME_ENDPOINT, _API_KEY, and _DEPLOYMENT to enable.",
    });
  }

  // Create an ephemeral session via Azure Realtime sessions API.
  // Note: path is `/openai/realtimeapi/sessions` (preview), NOT `/openai/realtime/sessions`.
  const url = `${cfg.endpoint.replace(/\/$/, "")}/openai/realtimeapi/sessions?api-version=${cfg.apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "api-key": cfg.apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      model: cfg.deployment,
      voice: "alloy",
      instructions: voiceSystemPrompt(),
      tools: AGENT_TOOLS.map((t) => ({
        type: "function",
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return reply.code(res.status).send({ error: "session mint failed", detail: text });
  }
  const session = await res.json();

  // WebRTC SDP exchange happens at a SEPARATE region-specific URL hosted by
  // Microsoft (not on the Azure resource endpoint). Pattern:
  //   https://{region}.realtimeapi-preview.ai.azure.com/v1/realtimertc
  // Allow override via env; otherwise auto-detect from the resource hostname.
  const explicit = process.env.AZURE_OPENAI_REALTIME_WEBRTC_URL?.trim();
  let webrtcUrl: string;
  if (explicit) {
    webrtcUrl = explicit;
  } else {
    const region = inferRegionFromEndpoint(cfg.endpoint);
    if (!region) {
      return reply
        .code(500)
        .send({
          error:
            "Cannot derive realtime WebRTC URL — set AZURE_OPENAI_REALTIME_WEBRTC_URL explicitly (e.g. https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc).",
        });
    }
    webrtcUrl = `https://${region}.realtimeapi-preview.ai.azure.com/v1/realtimertc`;
  }

  return reply.send({
    endpoint: cfg.endpoint,
    deployment: cfg.deployment,
    apiVersion: cfg.apiVersion,
    webrtcUrl,
    session,
  });
});

// Infer Azure region from a Cognitive Services endpoint hostname.
//   chand-moml63wo-eastus2.cognitiveservices.azure.com → "eastus2"
//   foo.eastus2.cognitiveservices.azure.com           → "eastus2"
function inferRegionFromEndpoint(endpoint: string): string | null {
  // Sorted longest-first so "eastus2" matches before "eastus".
  const KNOWN = [
    "germanywestcentral", "switzerlandnorth", "southafricanorth",
    "northcentralus", "southcentralus", "westcentralus",
    "australiaeast", "francecentral", "swedencentral", "koreacentral",
    "centralindia", "southindia", "westindia",
    "northeurope", "westeurope", "southeastasia",
    "canadacentral", "canadaeast", "brazilsouth",
    "japaneast", "japanwest", "eastasia", "uaenorth",
    "eastus2", "westus2", "westus3", "uksouth", "ukwest", "centralus",
    "eastus", "westus",
  ];
  const host = new URL(endpoint).hostname.toLowerCase();
  for (const r of KNOWN) {
    if (host.includes(r)) return r;
  }
  return null;
}

// Voice tool execution endpoint — browser forwards a tool_call to here.
app.post("/voice/tool", async (req, reply) => {
  const body = (req.body ?? {}) as { name: string; arguments: string };
  if (!body.name) return reply.code(400).send({ error: "missing tool name" });
  const result = await executeToolCall(body.name, body.arguments ?? "{}");
  return reply.send(result);
});

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
