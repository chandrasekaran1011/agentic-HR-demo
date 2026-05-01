import Fastify from "fastify";
import { z } from "zod";
import type { Candidate } from "@hr-agent/shared";
import { runOnboarding, amendOnboarding } from "./supervisor/run-cascade";
import { getRedis } from "./lib/redis";

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

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
