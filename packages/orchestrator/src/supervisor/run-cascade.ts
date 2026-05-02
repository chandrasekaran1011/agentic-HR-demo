import type { Candidate, SystemName } from "@hr-agent/shared";
import { getRedis } from "../lib/redis";
import { publishAgentEvent } from "../lib/events";
import { computeDesiredState } from "./compute-desired-state";
import { diffState } from "./diff-state";
import { updateCandidateProgress, commitSystemAction } from "../tools/ticket-helpers";

import { HrmsAgent } from "../agents/hrms-agent";
import { DocumentAgent } from "../agents/document-agent";
import { BuddyAgent } from "../agents/buddy-agent";
import { ItAgent } from "../agents/it-agent";
import { SoftwareAgent } from "../agents/software-agent";
import { TrainingAgent } from "../agents/training-agent";
import { IdCardAgent } from "../agents/idcard-agent";
import { PayrollAgent } from "../agents/payroll-agent";
import { SeatingAgent } from "../agents/seating-agent";
import { ParkingAgent } from "../agents/parking-agent";
import { ManagerNotifyAgent } from "../agents/manager-notify-agent";
import { WelcomeAgent } from "../agents/welcome-agent";
import type { BaseAgent } from "../agents/base-agent";

const AGENT_REGISTRY: Record<SystemName, () => BaseAgent> = {
  hrms: () => new HrmsAgent(),
  documents: () => new DocumentAgent(),
  buddy: () => new BuddyAgent(),
  it: () => new ItAgent(),
  software: () => new SoftwareAgent(),
  training: () => new TrainingAgent(),
  idcard: () => new IdCardAgent(),
  payroll: () => new PayrollAgent(),
  seating: () => new SeatingAgent(),
  parking: () => new ParkingAgent(),
  manager_notify: () => new ManagerNotifyAgent(),
  welcome: () => new WelcomeAgent(),
};

const NARRATION_CUES: { offsetMs: number; text: string }[] = [
  { offsetMs: 100, text: "Creating HRMS record." },
  { offsetMs: 1500, text: "Now provisioning IT, software, and training in parallel." },
  { offsetMs: 4000, text: "Setting up workplace logistics." },
  { offsetMs: 7000, text: "Sending welcome notifications." },
];

async function emitNarrationCues(candidateId: string, runId: string, startMs: number): Promise<void> {
  for (const cue of NARRATION_CUES) {
    setTimeout(() => {
      publishAgentEvent({
        type: "narration.cue",
        candidate_id: candidateId,
        payload: { text: cue.text },
        timestamp: new Date().toISOString(),
        run_id: runId,
      }).catch(() => {});
    }, startMs + cue.offsetMs);
  }
}

export async function runOnboarding(candidate: Candidate): Promise<{ run_id: string }> {
  const runId = `run-${Date.now()}`;
  const r = getRedis();

  // Persist candidate (or upsert) and seed empty tiles
  await r.hset(`candidate:${candidate.id}`, {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
    role: candidate.role,
    team: candidate.team,
    manager: candidate.manager,
    joining_date: candidate.joining_date,
    current_city: candidate.current_city ?? "",
    status: "in_progress",
    progress: "0",
    photo_url: candidate.photo_url,
    created_at: candidate.created_at,
    updated_at: new Date().toISOString(),
  });
  await r.sadd("candidates:active", candidate.id);
  await r.zadd("candidates:by_joining", new Date(candidate.joining_date).getTime(), candidate.id);

  await publishAgentEvent({
    type: "candidate.create",
    candidate_id: candidate.id,
    payload: { name: candidate.name, role: candidate.role, team: candidate.team, joining_date: candidate.joining_date, status: "in_progress", progress: 0 },
    timestamp: new Date().toISOString(),
    run_id: runId,
  });

  // Pre-seed all 12 tiles to "pending" so the UI shows the empty grid
  const allSystems: SystemName[] = [
    "hrms", "documents", "buddy", "it", "software", "training",
    "welcome", "idcard", "payroll", "manager_notify", "seating", "parking",
  ];
  for (const s of allSystems) {
    await commitSystemAction({ candidateId: candidate.id, system: s, status: "pending", runId });
  }

  // Compute and persist desired state
  const desired = await computeDesiredState(candidate);
  await r.set(`desired:${candidate.id}`, JSON.stringify(desired));

  await r.hset(`agent:run:${runId}`, {
    run_id: runId,
    candidate_id: candidate.id,
    started_at: new Date().toISOString(),
  });

  // Fire narration cues on a timer
  emitNarrationCues(candidate.id, runId, 0).catch(() => {});

  // Wave 1 (solo): HRMS — generates emp_id
  await runAgent("hrms", candidate, runId);

  // Wave 2 (parallel): 9 sub-agents
  const wave2: SystemName[] = ["documents", "buddy", "it", "software", "training", "idcard", "payroll", "seating", "parking"];
  await Promise.all(wave2.map((s) => runAgent(s, candidate, runId)));

  // Wave 3 (parallel): manager_notify + welcome
  const wave3: SystemName[] = ["manager_notify", "welcome"];
  await Promise.all(wave3.map((s) => runAgent(s, candidate, runId)));

  // Update candidate progress + final status
  await updateCandidateProgress(candidate.id);

  const completedAt = new Date().toISOString();
  await r.hset(`agent:run:${runId}`, "completed_at", completedAt);
  await publishAgentEvent({
    type: "cascade.complete",
    candidate_id: candidate.id,
    payload: { run_id: runId, completed_at: completedAt },
    timestamp: completedAt,
    run_id: runId,
  });

  return { run_id: runId };
}

async function runAgent(system: SystemName, candidate: Candidate, runId: string): Promise<void> {
  const agent = AGENT_REGISTRY[system]();
  const desired = JSON.parse(((await getRedis().get(`desired:${candidate.id}`)) ?? "{}"));
  await agent.run({
    candidate,
    subconfig: (desired as Record<string, unknown>)[system] ?? {},
    runId,
  });
}

/**
 * HR self-service: re-execute a single sub-agent for a candidate.
 * Used by per-tile actions on the candidate detail page (re-run, re-send,
 * re-assign buddy). `override` is merged into the subconfig the agent sees,
 * so e.g. `{buddy_email: "..."}` can override the buddy pick.
 */
export async function runSingleSystem(
  candidateId: string,
  system: SystemName,
  override?: Record<string, unknown>
): Promise<{ run_id: string }> {
  const r = getRedis();
  const c = await r.hgetall(`candidate:${candidateId}`);
  if (!c.id) throw new Error(`candidate not found: ${candidateId}`);

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

  const runId = `single-${system}-${Date.now()}`;

  // Merge override into the existing desired-state slice for this system
  const desired = JSON.parse(((await r.get(`desired:${candidateId}`)) ?? "{}"));
  const slice = { ...((desired as Record<string, unknown>)[system] ?? {}), ...(override ?? {}) };

  const agent = AGENT_REGISTRY[system]();
  await agent.run({ candidate, subconfig: slice, runId });
  await updateCandidateProgress(candidateId);

  return { run_id: runId };
}

export async function amendOnboarding(
  candidate: Candidate,
  changes: Partial<Pick<Candidate, "role" | "team" | "manager" | "joining_date" | "email">>
): Promise<{ run_id: string; affected: SystemName[] }> {
  const r = getRedis();
  const runId = `amend-${Date.now()}`;
  const oldDesiredRaw = await r.get(`desired:${candidate.id}`);
  if (!oldDesiredRaw) throw new Error("no existing desired state — run onboarding first");
  const oldDesired = JSON.parse(oldDesiredRaw);

  const updatedCandidate: Candidate = { ...candidate, ...changes };
  await r.hset(`candidate:${candidate.id}`, {
    role: updatedCandidate.role,
    team: updatedCandidate.team,
    manager: updatedCandidate.manager,
    joining_date: updatedCandidate.joining_date,
    email: updatedCandidate.email,
    updated_at: new Date().toISOString(),
  });

  const newDesired = await computeDesiredState(updatedCandidate);
  await r.set(`desired:${candidate.id}`, JSON.stringify(newDesired));

  const affected = diffState(oldDesired, newDesired);

  await publishAgentEvent({
    type: "cascade.amend.start",
    candidate_id: candidate.id,
    payload: { run_id: runId, affected },
    timestamp: new Date().toISOString(),
    run_id: runId,
  });

  // Mark affected tiles as amending, then re-run
  for (const s of affected) {
    await commitSystemAction({
      candidateId: candidate.id,
      system: s,
      status: "amending",
      runId,
    });
  }
  await Promise.all(affected.map((s) => runAgent(s, updatedCandidate, runId)));

  await updateCandidateProgress(candidate.id);
  await publishAgentEvent({
    type: "cascade.complete",
    candidate_id: candidate.id,
    payload: { run_id: runId, completed_at: new Date().toISOString(), amend: true, affected },
    timestamp: new Date().toISOString(),
    run_id: runId,
  });

  return { run_id: runId, affected };
}
