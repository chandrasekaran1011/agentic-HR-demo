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
