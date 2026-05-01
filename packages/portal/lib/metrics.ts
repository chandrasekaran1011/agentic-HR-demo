import { listCandidates } from "./seed-candidates";
import { getRedis } from "./redis";

const MANUAL_BASELINE_SECONDS = 6 * 3600 + 12 * 60; // 6h 12m per onboarding

export interface Metrics {
  total_candidates: number;
  in_progress: number;
  complete: number;
  pending: number;
  avg_progress: number;
  total_runs: number;
  avg_run_seconds: number;
  total_time_saved_seconds: number;
}

export async function getMetrics(): Promise<Metrics> {
  const all = await listCandidates();
  const inProgress = all.filter((c) => c.status === "in_progress").length;
  const complete = all.filter((c) => c.status === "complete").length;
  const pending = all.filter((c) => c.status === "pending").length;
  const avgProgress =
    all.length === 0 ? 0 : all.reduce((s, c) => s + c.progress, 0) / all.length;

  // Read run records for cascade durations.
  const r = getRedis();
  const runKeys = await r.keys("agent:run:*");
  let totalRunSeconds = 0;
  let runsWithDuration = 0;
  for (const key of runKeys) {
    const run = await r.hgetall(key);
    if (run.started_at && run.completed_at) {
      const dur = (new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000;
      if (dur > 0 && dur < 600) {
        totalRunSeconds += dur;
        runsWithDuration++;
      }
    }
  }
  const avgRunSeconds = runsWithDuration > 0 ? totalRunSeconds / runsWithDuration : 0;
  // Time saved = baseline × completed onboardings minus actual cascade time used
  const totalTimeSavedSeconds = Math.max(
    0,
    complete * MANUAL_BASELINE_SECONDS - totalRunSeconds
  );

  return {
    total_candidates: all.length,
    in_progress: inProgress,
    complete,
    pending,
    avg_progress: Math.round(avgProgress * 10) / 10,
    total_runs: runsWithDuration,
    avg_run_seconds: Math.round(avgRunSeconds * 10) / 10,
    total_time_saved_seconds: Math.round(totalTimeSavedSeconds),
  };
}

export interface ActivityEntry {
  ts: string;
  candidate_id: string;
  type: string;
  msg: string;
}

export async function getRecentActivity(limit = 10): Promise<ActivityEntry[]> {
  const r = getRedis();
  // Aggregate from all candidate audit lists, take last `limit` chronologically
  const ids = await r.smembers("candidates:active");
  const all: ActivityEntry[] = [];
  for (const id of ids) {
    const items = await r.lrange(`audit:${id}`, -limit, -1);
    for (const s of items) {
      try {
        const a = JSON.parse(s);
        all.push({
          ts: a.ts,
          candidate_id: id,
          type: a.event,
          msg: a.msg,
        });
      } catch {}
    }
  }
  return all.sort((x, y) => y.ts.localeCompare(x.ts)).slice(0, limit);
}
