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
