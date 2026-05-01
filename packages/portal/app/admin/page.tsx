import { AppShell } from "@/components/app-shell";
import { getMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const m = await getMetrics();
  return (
    <AppShell>
      <div className="p-8 space-y-8">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <div className="grid grid-cols-4 gap-4">
          <Card label="Total candidates" value={m.total_candidates} />
          <Card label="In progress" value={m.in_progress} />
          <Card label="Complete" value={m.complete} />
          <Card label="Pending" value={m.pending} />
        </div>
        <p className="text-sm text-slate-500">
          Phase 2 will add: time-saved counter, recent activity feed, big-number reveal.
        </p>
      </div>
    </AppShell>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="text-4xl font-semibold mt-2">{value}</p>
    </div>
  );
}
