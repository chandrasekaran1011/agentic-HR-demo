import Fastify from "fastify";
import { z } from "zod";
import type { Candidate } from "@hr-agent/shared";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { runOnboarding, amendOnboarding } from "./supervisor/run-cascade";
import { getRedis } from "./lib/redis";
import { AGENT_TOOLS, executeToolCall } from "./agent-tools/index.js";
import { chatComplete, isMockMode } from "./llm/azure-openai";
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
    role: z.enum(["user", "assistant", "tool", "system"]),
    content: z.string().nullable().optional(),
    tool_calls: z.array(z.any()).optional(),
    tool_call_id: z.string().optional(),
    name: z.string().optional(),
  })),
});

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

  // Build messages with system prompt
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: chatSystemPrompt() },
    ...(parsed.data.messages as ChatCompletionMessageParam[]),
  ];

  // Tool-calling loop
  const MAX_ITERATIONS = 5;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const completion = await chatComplete({
      messages,
      tools: AGENT_TOOLS,
      maxTokens: 512,
    });
    const choice = completion.choices[0];
    if (!choice) break;
    const msg = choice.message;

    // Append assistant message
    messages.push({
      role: "assistant",
      content: msg.content ?? "",
      tool_calls: msg.tool_calls,
    } as ChatCompletionMessageParam);

    if (msg.content) {
      send({ type: "delta", text: msg.content });
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        if (tc.type !== "function") continue;
        send({ type: "tool_call", id: tc.id, name: tc.function.name, args: tc.function.arguments });
        const result = await executeToolCall(tc.function.name, tc.function.arguments);
        send({ type: "tool_result", id: tc.id, result });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        } as ChatCompletionMessageParam);
      }
      continue; // loop again so model can react to tool results
    }
    break;
  }

  send({ type: "done" });
  reply.raw.end();
  return reply;
});

// ─── Voice session minting ───────────────────────────────────────

app.get("/voice/session", async (_req, reply) => {
  // For Azure OpenAI Realtime, the browser uses an ephemeral key from the
  // /sessions endpoint. We expose enough config for the client to negotiate
  // the WebRTC connection directly.
  if (isMockMode()) {
    return reply.send({
      mock: true,
      message: "Realtime API mock mode — voice will not work without AZURE_OPENAI_API_KEY.",
    });
  }
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-01-preview";
  if (!endpoint || !apiKey || !deployment) {
    return reply.code(500).send({ error: "AZURE_OPENAI_REALTIME_DEPLOYMENT or related env not set" });
  }

  // Create an ephemeral session via Azure Realtime sessions API.
  const url = `${endpoint.replace(/\/$/, "")}/openai/realtime/sessions?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      model: deployment,
      voice: "alloy",
      instructions: chatSystemPrompt(),
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
  return reply.send({
    endpoint,
    deployment,
    apiVersion,
    session,
  });
});

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
