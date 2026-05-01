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
        await r.hset(`ticket:${tile.system}:${tile.ticket_id}`, {
          ticket_id: tile.ticket_id,
          candidate_id: seed.id,
          status: tile.status,
          artifact_summary: tile.artifact_summary ?? "",
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
