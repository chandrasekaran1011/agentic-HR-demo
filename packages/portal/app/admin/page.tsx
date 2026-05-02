import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getMetrics, getRecentActivity } from "@/lib/metrics";
import { BigNumber } from "@/components/big-number";
import { formatHM, formatDuration } from "@/lib/format";
import { SavingsBar } from "@/components/savings-bar";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [m, activity] = await Promise.all([getMetrics(), getRecentActivity(10)]);
  return (
    <AppShell>
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/admin/settings"
              className="text-slate-400 hover:text-slate-200 underline-offset-4 hover:underline"
            >
              Settings →
            </Link>
            <Link
              href="/admin/master-data"
              className="text-slate-400 hover:text-slate-200 underline-offset-4 hover:underline"
            >
              Master data →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card label="Onboardings completed">
            <BigNumber value={m.complete} className="text-5xl font-semibold mt-2 tabular-nums" />
          </Card>
          <Card label="Avg cascade time">
            <BigNumber
              value={m.avg_run_seconds}
              format="duration"
              className="text-5xl font-semibold mt-2 tabular-nums"
            />
          </Card>
          <Card label="In progress">
            <BigNumber value={m.in_progress} className="text-5xl font-semibold mt-2 tabular-nums text-amber-400" />
          </Card>
          <Card label="Time saved">
            <BigNumber
              value={m.total_time_saved_seconds}
              format="hm"
              className="text-5xl font-semibold mt-2 tabular-nums text-emerald-400"
            />
          </Card>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-sm text-slate-400 mb-4">
            Time saved · {m.complete} cascades × baseline {formatHM(6 * 3600 + 12 * 60)} per manual onboarding
          </h2>
          <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
            <SavingsBar percent={Math.min(100, (m.total_time_saved_seconds / Math.max(1, m.complete * (6 * 3600 + 12 * 60))) * 100)} />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Manual baseline: {formatHM(6 * 3600 + 12 * 60)} per onboarding · Agent runtime per cascade: {formatDuration(m.avg_run_seconds)}
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Nothing yet.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((a, i) => (
                <li key={i} className="text-sm flex gap-3 border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500 font-mono">
                    {new Date(a.ts).toLocaleTimeString()}
                  </span>
                  <Link
                    href={`/candidates/${a.candidate_id}`}
                    className="text-slate-300 hover:text-slate-100 min-w-[140px]"
                  >
                    {a.candidate_id}
                  </Link>
                  <span className="text-slate-200">{a.msg}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{label}</p>
      {children}
    </div>
  );
}

