import { listCandidates } from "./seed-candidates";

export interface Metrics {
  total_candidates: number;
  in_progress: number;
  complete: number;
  pending: number;
  avg_progress: number;
}

export async function getMetrics(): Promise<Metrics> {
  const all = await listCandidates();
  const inProgress = all.filter((c) => c.status === "in_progress").length;
  const complete = all.filter((c) => c.status === "complete").length;
  const pending = all.filter((c) => c.status === "pending").length;
  const avgProgress =
    all.length === 0 ? 0 : all.reduce((s, c) => s + c.progress, 0) / all.length;
  return {
    total_candidates: all.length,
    in_progress: inProgress,
    complete,
    pending,
    avg_progress: Math.round(avgProgress * 10) / 10,
  };
}
