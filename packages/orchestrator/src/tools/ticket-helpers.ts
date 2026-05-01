import { getRedis } from "../lib/redis";
import { publishAgentEvent } from "../lib/events";
import type { SystemName, TileStatus, AgentEvent } from "@hr-agent/shared";

const TICKET_PREFIXES: Record<SystemName, string> = {
  hrms: "EMP",
  documents: "DOC",
  buddy: "BUD",
  it: "IT",
  software: "SW",
  training: "TR",
  welcome: "WEL",
  idcard: "ID",
  payroll: "PAY",
  manager_notify: "MGR",
  seating: "SEAT",
  parking: "PARK",
};

export async function generateTicketId(system: SystemName): Promise<string> {
  const r = getRedis();
  const counter = await r.incr(`counter:ticket:${system}`);
  const year = new Date().getUTCFullYear();
  return `${TICKET_PREFIXES[system]}-${year}-${String(counter).padStart(4, "0")}`;
}

export interface CommitArgs {
  candidateId: string;
  system: SystemName;
  status: TileStatus;
  ticketId?: string;
  artifactSummary?: string;
  ticketFields?: Record<string, string>;
  auditMsg?: string;
  runId?: string;
}

export async function commitSystemAction(args: CommitArgs): Promise<void> {
  const r = getRedis();
  const ts = new Date().toISOString();

  // Tile state
  const tileFields: Record<string, string> = { status: args.status };
  if (args.ticketId) tileFields.ticket_id = args.ticketId;
  if (args.artifactSummary) tileFields.artifact_summary = args.artifactSummary;
  if (args.status === "in_progress") tileFields.started_at = ts;
  if (args.status === "done" || args.status === "error") tileFields.completed_at = ts;
  await r.hset(`tile:${args.candidateId}:${args.system}`, tileFields);

  // Persist ticket fields if provided (only when ticket is being created)
  if (args.ticketId && args.ticketFields) {
    await r.hset(`ticket:${args.system}:${args.ticketId}`, {
      ticket_id: args.ticketId,
      candidate_id: args.candidateId,
      ...args.ticketFields,
    });
    await r.rpush(`system:${args.system}:tickets`, args.ticketId);
  }

  // Audit
  if (args.auditMsg) {
    const audit: Record<string, unknown> = { ts, event: "tile.update", system: args.system, msg: args.auditMsg };
    if (args.ticketId) audit.ticket_id = args.ticketId;
    await r.rpush(`audit:${args.candidateId}`, JSON.stringify(audit));
  }

  // Publish
  const event: AgentEvent = {
    type: "tile.update",
    candidate_id: args.candidateId,
    system: args.system,
    payload: {
      status: args.status,
      ticket_id: args.ticketId,
      artifact_summary: args.artifactSummary,
    },
    timestamp: ts,
    run_id: args.runId,
  };
  await publishAgentEvent(event);

  if (args.auditMsg) {
    await publishAgentEvent({
      type: "audit.append",
      candidate_id: args.candidateId,
      system: args.system,
      payload: { msg: args.auditMsg, ticket_id: args.ticketId },
      timestamp: ts,
      run_id: args.runId,
    });
  }
}

export async function updateCandidateProgress(candidateId: string): Promise<void> {
  const r = getRedis();
  // Count "done" tiles
  const SYSTEMS = [
    "hrms", "documents", "buddy", "it", "software", "training",
    "welcome", "idcard", "payroll", "manager_notify", "seating", "parking",
  ];
  let done = 0;
  for (const s of SYSTEMS) {
    const status = await r.hget(`tile:${candidateId}:${s}`, "status");
    if (status === "done") done++;
  }
  const status = done === 12 ? "complete" : done === 0 ? "pending" : "in_progress";
  await r.hset(`candidate:${candidateId}`, {
    progress: String(done),
    status,
    updated_at: new Date().toISOString(),
  });
  await publishAgentEvent({
    type: "candidate.update",
    candidate_id: candidateId,
    payload: { progress: done, status },
    timestamp: new Date().toISOString(),
  });
}
