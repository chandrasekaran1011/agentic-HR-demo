import { getRedis } from "../lib/redis";
import type { Role, Software, Team } from "@hr-agent/shared";

async function hgetParse<T>(key: string, field: string): Promise<T | null> {
  const r = getRedis();
  const v = await r.hget(key, field);
  if (!v) return null;
  return JSON.parse(v) as T;
}

export async function lookupRole(roleName: string): Promise<Role | null> {
  const r = getRedis();
  const all = await r.hgetall("master:roles");
  for (const v of Object.values(all)) {
    const role = JSON.parse(v) as Role;
    if (role.name === roleName || role.id === roleName) return role;
  }
  // Soft match: case-insensitive
  for (const v of Object.values(all)) {
    const role = JSON.parse(v) as Role;
    if (role.name.toLowerCase() === roleName.toLowerCase()) return role;
  }
  return null;
}

export async function lookupSoftwareForRole(roleId: string): Promise<string[]> {
  const r = getRedis();
  const v = await r.hget("master:matrix:software", roleId);
  return v ? (JSON.parse(v) as string[]) : [];
}

export async function lookupSoftwareCatalogEntry(softwareId: string): Promise<Software | null> {
  return hgetParse<Software>("master:software", softwareId);
}

export async function lookupTeam(teamNameOrId: string): Promise<Team | null> {
  const r = getRedis();
  const all = await r.hgetall("master:teams");
  for (const v of Object.values(all)) {
    const team = JSON.parse(v) as Team;
    if (team.id === teamNameOrId || team.name === teamNameOrId) return team;
  }
  for (const v of Object.values(all)) {
    const team = JSON.parse(v) as Team;
    if (team.name.toLowerCase() === teamNameOrId.toLowerCase()) return team;
  }
  return null;
}

export interface LaptopConfig {
  role_family: string;
  level: string;
  model: string;
  ram: string;
  cpu: string;
  accessories: string[];
}

export async function lookupLaptopFor(roleFamily: string, level: string): Promise<LaptopConfig | null> {
  return hgetParse<LaptopConfig>("master:laptops", `${roleFamily}:${level}`);
}

export interface SalaryBand {
  role_family: string;
  level: string;
  band: string;
}

export async function lookupSalaryBand(roleFamily: string, level: string): Promise<SalaryBand | null> {
  return hgetParse<SalaryBand>("master:salary", `${roleFamily}:${level}`);
}

export interface DocumentChecklist {
  country: string;
  role_type: string;
  documents: string[];
}

export async function lookupDocumentsFor(country: string, roleType: string): Promise<DocumentChecklist | null> {
  return hgetParse<DocumentChecklist>("master:documents", `${country}:${roleType}`);
}

export interface TrainingMatrix {
  role_family: string;
  team?: string;
  required: string[];
  recommended: string[];
}

export async function lookupCoursesFor(roleFamily: string): Promise<TrainingMatrix | null> {
  return hgetParse<TrainingMatrix>("master:matrix:training", roleFamily);
}
