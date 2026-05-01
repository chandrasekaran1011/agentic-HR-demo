import { getRedis } from "./redis";
import type { Role, Software, Team } from "@hr-agent/shared";

export async function listRoles(): Promise<Role[]> {
  const r = getRedis();
  const all = await r.hgetall("master:roles");
  return Object.values(all).map((v) => JSON.parse(v) as Role);
}

export async function listSoftware(): Promise<Software[]> {
  const r = getRedis();
  const all = await r.hgetall("master:software");
  return Object.values(all).map((v) => JSON.parse(v) as Software);
}

export async function listTeams(): Promise<Team[]> {
  const r = getRedis();
  const all = await r.hgetall("master:teams");
  return Object.values(all).map((v) => JSON.parse(v) as Team);
}

export async function getRoleSoftwareMatrix(): Promise<Record<string, string[]>> {
  const r = getRedis();
  const all = await r.hgetall("master:matrix:software");
  const out: Record<string, string[]> = {};
  for (const [roleId, json] of Object.entries(all)) out[roleId] = JSON.parse(json);
  return out;
}

export async function setRoleSoftwareMatrix(roleId: string, softwareIds: string[]): Promise<void> {
  const r = getRedis();
  await r.hset("master:matrix:software", roleId, JSON.stringify(softwareIds));
}

export async function toggleRoleSoftware(roleId: string, softwareId: string): Promise<string[]> {
  const r = getRedis();
  const current = await r.hget("master:matrix:software", roleId);
  const list: string[] = current ? JSON.parse(current) : [];
  const idx = list.indexOf(softwareId);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(softwareId);
  await r.hset("master:matrix:software", roleId, JSON.stringify(list));
  return list;
}

export interface TrainingMatrixEntry {
  role_family: string;
  required: string[];
  recommended: string[];
}

export async function getTrainingMatrix(): Promise<TrainingMatrixEntry[]> {
  const r = getRedis();
  const all = await r.hgetall("master:matrix:training");
  return Object.values(all).map((v) => JSON.parse(v) as TrainingMatrixEntry);
}
