import { z } from "zod";
import type { Candidate } from "@hr-agent/shared";
import { lookupRole, lookupTeam, lookupSoftwareForRole, lookupCoursesFor, lookupLaptopFor, lookupSalaryBand, lookupDocumentsFor } from "../tools/master-data";

export const DesiredStateSchema = z.object({
  hrms: z.object({ department: z.string(), designation: z.string(), level: z.string() }),
  documents: z.object({ checklist: z.array(z.string()) }),
  buddy: z.object({ team: z.string() }),
  it: z.object({ laptop_model: z.string(), ram: z.string(), cpu: z.string() }),
  software: z.object({ entitlements: z.array(z.string()) }),
  training: z.object({ courses: z.array(z.string()) }),
  welcome: z.object({ recipient: z.string(), team: z.string() }),
  idcard: z.object({ type: z.literal("standard") }),
  payroll: z.object({ band: z.string() }),
  manager_notify: z.object({ manager: z.string(), email: z.string() }),
  seating: z.object({ floor: z.number(), wing: z.string() }),
  parking: z.object({ eligible: z.boolean() }),
});

export type DesiredState = z.infer<typeof DesiredStateSchema>;

/**
 * Deterministic for stage reliability — reads master data + candidate fields.
 * The LLM-based plan was considered but rejected: 12 known systems with
 * tagged master data is more reliable on stage than a planning prompt.
 */
export async function computeDesiredState(candidate: Candidate): Promise<DesiredState> {
  const role = await lookupRole(candidate.role);
  const team = await lookupTeam(candidate.team);
  const family = role?.family ?? "engineering";
  const level = role?.level ?? "senior";

  const softwareIds = role ? await lookupSoftwareForRole(role.id) : [];
  const trainingMatrix = await lookupCoursesFor(family);
  const laptop = await lookupLaptopFor(family, level);
  const band = await lookupSalaryBand(family, level);
  const docs = await lookupDocumentsFor("IN", "fulltime");

  const allCourses = [...(trainingMatrix?.required ?? []), ...(trainingMatrix?.recommended ?? [])];

  return {
    hrms: { department: family, designation: candidate.role, level },
    documents: { checklist: docs?.documents ?? [] },
    buddy: { team: candidate.team },
    it: {
      laptop_model: laptop?.model ?? "MacBook Pro 16",
      ram: laptop?.ram ?? "32GB",
      cpu: laptop?.cpu ?? "M3 Pro",
    },
    software: { entitlements: softwareIds },
    training: { courses: allCourses },
    welcome: { recipient: candidate.email, team: candidate.team },
    idcard: { type: "standard" },
    payroll: { band: band?.band ?? "L5" },
    manager_notify: { manager: candidate.manager, email: team?.manager_email ?? "manager@unknown" },
    seating: { floor: team?.floor ?? 3, wing: team?.wing ?? "east" },
    parking: { eligible: team?.parking_eligibility !== "none" },
  };
}
