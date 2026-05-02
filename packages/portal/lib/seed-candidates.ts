import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { getRedis } from "./redis";
import {
  CandidateSeedSchema,
  SYSTEMS,
  type Candidate,
  type Tile,
  type AuditEntry,
  type SystemName,
} from "@hr-agent/shared";

function seedDir(): string {
  return process.env.SEED_DATA_DIR ?? path.join(process.cwd(), "..", "..", "seed-data");
}

export async function loadSeedCandidates(): Promise<void> {
  const raw = await fs.readFile(path.join(seedDir(), "candidates.json"), "utf-8");
  const seeds = z.array(CandidateSeedSchema).parse(JSON.parse(raw));

  const r = getRedis();
  for (const seed of seeds) {
    const now = new Date().toISOString();
    const candidate: Candidate = {
      id: seed.id,
      name: seed.name,
      email: seed.email,
      role: seed.role,
      team: seed.team,
      manager: seed.manager,
      joining_date: seed.joining_date,
      current_city: seed.current_city,
      status: seed.status,
      progress: seed.progress,
      photo_url: seed.photo_url,
      created_at: now,
      updated_at: now,
    };

    const candHash: Record<string, string> = {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      role: candidate.role,
      team: candidate.team,
      manager: candidate.manager,
      joining_date: candidate.joining_date,
      status: candidate.status,
      progress: String(candidate.progress),
      photo_url: candidate.photo_url,
      created_at: candidate.created_at,
      updated_at: candidate.updated_at,
    };
    if (candidate.current_city) candHash.current_city = candidate.current_city;
    await r.hset(`candidate:${seed.id}`, candHash);
    await r.sadd("candidates:active", seed.id);
    await r.zadd("candidates:by_joining", new Date(seed.joining_date).getTime(), seed.id);

    for (const tile of seed.initial_tiles ?? []) {
      const fields: Record<string, string> = { status: tile.status };
      if (tile.ticket_id) fields.ticket_id = tile.ticket_id;
      if (tile.artifact_summary) fields.artifact_summary = tile.artifact_summary;
      await r.hset(`tile:${seed.id}:${tile.system}`, fields);

      if (tile.ticket_id) {
        const enriched = await enrichSeedTicket(seed, tile.system, r);
        await r.hset(`ticket:${tile.system}:${tile.ticket_id}`, {
          ticket_id: tile.ticket_id,
          candidate_id: seed.id,
          status: tile.status,
          artifact_summary: tile.artifact_summary ?? "",
          ...enriched,
        });
        await r.rpush(`system:${tile.system}:tickets`, tile.ticket_id);
      }
    }

    for (const a of seed.initial_audit ?? []) {
      await r.rpush(`audit:${seed.id}`, JSON.stringify(a));
    }
  }
}

export async function listCandidates(): Promise<Candidate[]> {
  const r = getRedis();
  const ids = await r.zrange("candidates:by_joining", 0, -1);
  const candidates: Candidate[] = [];
  for (const id of ids) {
    const c = await r.hgetall(`candidate:${id}`);
    if (c.id) {
      candidates.push({
        ...c,
        progress: parseInt(c.progress ?? "0", 10),
      } as unknown as Candidate);
    }
  }
  return candidates;
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const r = getRedis();
  const c = await r.hgetall(`candidate:${id}`);
  if (!c.id) return null;
  return { ...c, progress: parseInt(c.progress ?? "0", 10) } as unknown as Candidate;
}

export async function getTiles(candidateId: string): Promise<Tile[]> {
  const r = getRedis();
  const tiles: Tile[] = [];
  for (const system of SYSTEMS) {
    const data = await r.hgetall(`tile:${candidateId}:${system}`);
    tiles.push({
      candidate_id: candidateId,
      system,
      status: (data.status as Tile["status"]) ?? "pending",
      ticket_id: data.ticket_id,
      artifact_summary: data.artifact_summary,
      started_at: data.started_at,
      completed_at: data.completed_at,
    });
  }
  return tiles;
}

export async function getAudit(candidateId: string): Promise<AuditEntry[]> {
  const r = getRedis();
  const items = await r.lrange(`audit:${candidateId}`, 0, -1);
  return items.map((s) => JSON.parse(s) as AuditEntry).reverse();
}

// ── Seed enrichment ───────────────────────────────────────────────
// Use master-data lookups to populate the same rich ticket fields the
// live agents would write, so already-onboarded seed candidates have
// answerable detail when HR asks "what laptop?", "who's her buddy?", etc.

import type Redis from "ioredis";
import type { CandidateSeed } from "@hr-agent/shared";

interface MasterRole {
  id: string;
  family: string;
  level: string;
  name: string;
}

interface MasterTeam {
  id: string;
  name: string;
  floor: number;
  wing: string;
  manager: string;
  manager_email: string;
  buddy_pool: { name: string; email: string; role_family: string; tenure_years: number }[];
  parking_eligibility: string;
}

interface MasterLaptop {
  role_family: string;
  level: string;
  model: string;
  ram: string;
  cpu: string;
  accessories: string[];
}

interface MasterSalary {
  role_family: string;
  level: string;
  band: string;
}

interface MasterTraining {
  role_family: string;
  required: string[];
  recommended: string[];
}

async function readMaster<T>(r: Redis, key: string, field: string): Promise<T | null> {
  const v = await r.hget(key, field);
  return v ? (JSON.parse(v) as T) : null;
}

async function findRoleByName(r: Redis, name: string): Promise<MasterRole | null> {
  const all = await r.hgetall("master:roles");
  for (const v of Object.values(all)) {
    const role = JSON.parse(v) as MasterRole;
    if (role.name === name || role.id === name) return role;
  }
  for (const v of Object.values(all)) {
    const role = JSON.parse(v) as MasterRole;
    if (role.name.toLowerCase() === name.toLowerCase()) return role;
  }
  return null;
}

async function findTeamByName(r: Redis, name: string): Promise<MasterTeam | null> {
  const all = await r.hgetall("master:teams");
  for (const v of Object.values(all)) {
    const team = JSON.parse(v) as MasterTeam;
    if (team.id === name || team.name === name) return team;
  }
  for (const v of Object.values(all)) {
    const team = JSON.parse(v) as MasterTeam;
    if (team.name.toLowerCase() === name.toLowerCase()) return team;
  }
  return null;
}

async function enrichSeedTicket(
  seed: CandidateSeed,
  system: string,
  r: Redis
): Promise<Record<string, string>> {
  const role = await findRoleByName(r, seed.role);
  const team = await findTeamByName(r, seed.team);
  const family = role?.family ?? "engineering";
  const level = role?.level ?? "senior";

  switch (system) {
    case "hrms":
      return {
        emp_id: seed.id,
        department: family,
        designation: seed.role,
        joining_date: seed.joining_date,
      };
    case "documents":
      return {
        candidate_email: seed.email,
        documents: [
          "PAN card",
          "Aadhaar",
          "Address proof",
          "Degree certificate",
          "Previous employer relieving letter",
        ].join(","),
      };
    case "buddy": {
      const pool = team?.buddy_pool ?? [];
      const buddy = [...pool].sort((a, b) => b.tenure_years - a.tenure_years)[0];
      if (!buddy) return {};
      return {
        buddy_name: buddy.name,
        buddy_email: buddy.email,
        team: seed.team,
        selection_reason: `${buddy.tenure_years}yr tenure, ${buddy.role_family}`,
      };
    }
    case "it": {
      const laptop = await readMaster<MasterLaptop>(r, "master:laptops", `${family}:${level}`);
      return {
        laptop_model: laptop?.model ?? "MacBook Pro 16",
        ram: laptop?.ram ?? "32GB",
        cpu: laptop?.cpu ?? "M3 Pro",
        accessories: (laptop?.accessories ?? []).join(","),
        status: "delivered",
      };
    }
    case "software": {
      if (!role) return {};
      const matrixRaw = await r.hget("master:matrix:software", role.id);
      const ids: string[] = matrixRaw ? JSON.parse(matrixRaw) : [];
      const names: string[] = [];
      for (const id of ids) {
        const sw = await r.hget("master:software", id);
        if (sw) names.push(JSON.parse(sw).name);
      }
      return {
        entitlements: names.join(", "),
        role_id: role.id,
      };
    }
    case "training": {
      const t = await readMaster<MasterTraining>(r, "master:matrix:training", family);
      if (!t) return {};
      return {
        required: t.required.join(", "),
        recommended: t.recommended.join(", "),
      };
    }
    case "welcome":
      return {
        recipients: seed.email,
        subject: `Welcome to ${seed.team}`,
        sent_at: seed.joining_date + "T09:00:00Z",
      };
    case "idcard":
      return {
        type: "standard",
        photo_status: "completed",
        card_status: "issued",
      };
    case "payroll": {
      const band = await readMaster<MasterSalary>(r, "master:salary", `${family}:${level}`);
      return {
        band: band?.band ?? "L5",
        bank_status: "active",
        pf_status: "active",
      };
    }
    case "manager_notify":
      return {
        manager_name: seed.manager,
        manager_email: team?.manager_email ?? "",
        channel: "email",
      };
    case "seating": {
      // Try to parse the artifact summary like "F2-E-08" → floor 2, wing E, desk 08
      const m = /F(\d+)-([A-Z])-(\d+)/.exec(
        (seed.initial_tiles ?? []).find((t) => t.system === "seating")?.artifact_summary ?? ""
      );
      const wingShort = m?.[2] ?? team?.wing?.[0]?.toUpperCase() ?? "E";
      return {
        floor: m?.[1] ?? String(team?.floor ?? 3),
        wing: team?.wing ?? "east",
        desk_code: m ? `F${m[1]}-${wingShort}-${m[3]}` : `F${team?.floor ?? 3}-${wingShort}-01`,
      };
    }
    case "parking": {
      const m = /P(\d+)-(\d+)/.exec(
        (seed.initial_tiles ?? []).find((t) => t.system === "parking")?.artifact_summary ?? ""
      );
      return {
        slot: m ? `P${m[1]}-${m[2]}` : "P1-01",
        vehicle_type: "4-wheeler",
      };
    }
    default:
      return {};
  }
}
