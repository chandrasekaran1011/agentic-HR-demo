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

export interface LaptopCatalogEntry {
  id: string;
  brand: string;
  model: string;
  ram: string;
  cpu: string;
  accessories: string[];
}

export async function listLaptopCatalog(): Promise<LaptopCatalogEntry[]> {
  const r = getRedis();
  const all = await r.hgetall("master:laptops:catalog");
  return Object.values(all).map((v) => JSON.parse(v) as LaptopCatalogEntry);
}

/**
 * Resolve a free-text laptop hint ("dell", "Dell XPS 15", "thinkpad x1") to
 * a catalog entry. Strategy: exact id → exact model → brand match → fuzzy
 * (substring on model + brand). Returns null if nothing matches well enough.
 */
export async function resolveLaptopFromHint(hint: string): Promise<LaptopCatalogEntry | null> {
  const catalog = await listLaptopCatalog();
  if (catalog.length === 0) return null;
  const q = hint.trim().toLowerCase();
  if (!q) return null;

  const byId = catalog.find((c) => c.id.toLowerCase() === q);
  if (byId) return byId;

  const byModel = catalog.find((c) => c.model.toLowerCase() === q);
  if (byModel) return byModel;

  // Brand-only hint ("dell", "lenovo") → return the first SKU of that brand
  const byBrand = catalog.find((c) => c.brand.toLowerCase() === q);
  if (byBrand) return byBrand;

  // Fuzzy contains on model OR brand
  const fuzzy = catalog.find(
    (c) =>
      c.model.toLowerCase().includes(q) ||
      c.brand.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
  );
  return fuzzy ?? null;
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
