import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { getRedis } from "./redis";
import {
  RoleSchema,
  SoftwareSchema,
  RoleSoftwareMatrixSchema,
  TeamSchema,
  LaptopConfigSchema,
  SalaryBandSchema,
  DocumentChecklistSchema,
  TrainingMatrixSchema,
  type Role,
} from "@hr-agent/shared";

function masterDataDir(): string {
  return process.env.MASTER_DATA_DIR ?? path.join(process.cwd(), "..", "..", "master-data");
}

async function readJson<T>(file: string, schema: z.ZodType<T>): Promise<T[]> {
  const raw = await fs.readFile(path.join(masterDataDir(), file), "utf-8");
  const parsed = JSON.parse(raw);
  return z.array(schema).parse(parsed);
}

export async function loadMasterData(): Promise<void> {
  const r = getRedis();

  const roles = await readJson("roles.json", RoleSchema);
  for (const role of roles) {
    await r.hset("master:roles", role.id, JSON.stringify(role));
  }

  const software = await readJson("software-catalog.json", SoftwareSchema);
  for (const sw of software) {
    await r.hset("master:software", sw.id, JSON.stringify(sw));
  }

  const matrix = await readJson("role-software-matrix.json", RoleSoftwareMatrixSchema);
  for (const m of matrix) {
    await r.hset("master:matrix:software", m.role_id, JSON.stringify(m.software_ids));
  }

  const teams = await readJson("teams.json", TeamSchema);
  for (const t of teams) {
    await r.hset("master:teams", t.id, JSON.stringify(t));
  }

  const laptops = await readJson("laptops.json", LaptopConfigSchema);
  for (const l of laptops) {
    await r.hset("master:laptops", `${l.role_family}:${l.level}`, JSON.stringify(l));
  }

  const bands = await readJson("salary-bands.json", SalaryBandSchema);
  for (const b of bands) {
    await r.hset("master:salary", `${b.role_family}:${b.level}`, JSON.stringify(b));
  }

  const docs = await readJson("documents.json", DocumentChecklistSchema);
  for (const d of docs) {
    await r.hset("master:documents", `${d.country}:${d.role_type}`, JSON.stringify(d));
  }

  const training = await readJson("training-matrix.json", TrainingMatrixSchema);
  for (const t of training) {
    await r.hset("master:matrix:training", t.role_family, JSON.stringify(t));
  }
}

export async function getMasterRoles(): Promise<Role[]> {
  const r = getRedis();
  const all = await r.hgetall("master:roles");
  return Object.values(all).map((v) => JSON.parse(v));
}

export async function getMasterSoftwareForRole(roleId: string): Promise<string[]> {
  const r = getRedis();
  const v = await r.hget("master:matrix:software", roleId);
  if (!v) return [];
  return JSON.parse(v);
}
