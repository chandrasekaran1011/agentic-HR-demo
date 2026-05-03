import { z } from "zod";

export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string(),
  level: z.enum(["junior", "mid", "senior", "staff", "principal"]),
});

export const SoftwareSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
});

export const RoleSoftwareMatrixSchema = z.object({
  role_id: z.string(),
  team: z.string().optional(),
  software_ids: z.array(z.string()),
});

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  floor: z.number(),
  wing: z.string(),
  manager: z.string(),
  manager_email: z.string().email(),
  buddy_pool: z.array(
    z.object({
      name: z.string(),
      email: z.string().email(),
      role_family: z.string(),
      tenure_years: z.number(),
    })
  ),
  parking_eligibility: z.enum(["all", "senior_only", "none"]),
});

export const LaptopConfigSchema = z.object({
  role_family: z.string(),
  level: z.string(),
  model: z.string(),
  ram: z.string(),
  cpu: z.string(),
  accessories: z.array(z.string()),
});

// Full catalog of laptop SKUs HR can pick from when overriding the
// role-default selection (e.g. "book Dell XPS 15 for Tyler").
export const LaptopCatalogEntrySchema = z.object({
  id: z.string(),
  brand: z.string(),
  model: z.string(),
  ram: z.string(),
  cpu: z.string(),
  accessories: z.array(z.string()),
});

export const SalaryBandSchema = z.object({
  role_family: z.string(),
  level: z.string(),
  band: z.string(),
});

export const DocumentChecklistSchema = z.object({
  country: z.string(),
  role_type: z.string(),
  documents: z.array(z.string()),
});

export const TrainingMatrixSchema = z.object({
  role_family: z.string(),
  team: z.string().optional(),
  required: z.array(z.string()),
  recommended: z.array(z.string()),
});

export const CandidateSeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  team: z.string(),
  manager: z.string(),
  joining_date: z.string(),
  current_city: z.string().optional(),
  status: z.enum(["pending", "in_progress", "complete"]),
  progress: z.number().int().min(0).max(12),
  photo_url: z.string(),
  initial_tiles: z
    .array(
      z.object({
        system: z.string(),
        status: z.enum(["pending", "in_progress", "done", "error", "amending"]),
        ticket_id: z.string().optional(),
        artifact_summary: z.string().optional(),
      })
    )
    .optional(),
  initial_audit: z
    .array(
      z.object({
        ts: z.string(),
        event: z.string(),
        system: z.string().optional(),
        ticket_id: z.string().optional(),
        msg: z.string(),
      })
    )
    .optional(),
});

export type Role = z.infer<typeof RoleSchema>;
export type Software = z.infer<typeof SoftwareSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type CandidateSeed = z.infer<typeof CandidateSeedSchema>;
export type LaptopCatalogEntry = z.infer<typeof LaptopCatalogEntrySchema>;
