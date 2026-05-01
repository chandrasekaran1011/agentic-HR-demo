import type { Tile } from "@hr-agent/shared";

const SYSTEM_LABELS: Record<string, string> = {
  hrms: "HRMS",
  documents: "Documents",
  buddy: "Buddy",
  it: "IT Asset",
  software: "Software",
  training: "Training",
  welcome: "Welcome",
  idcard: "ID Card",
  payroll: "Payroll",
  manager_notify: "Manager Notify",
  seating: "Seating",
  parking: "Parking",
};

const STATUS_RING: Record<Tile["status"], string> = {
  pending: "border-slate-700",
  in_progress: "border-amber-500/60",
  done: "border-emerald-500/60",
  error: "border-rose-500/60",
  amending: "border-amber-500/60",
};

const STATUS_LABEL: Record<Tile["status"], string> = {
  pending: "pending",
  in_progress: "in progress",
  done: "done",
  error: "error",
  amending: "amending",
};

export function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {tiles.map((t) => (
        <div
          key={t.system}
          className={`rounded-lg border-2 ${STATUS_RING[t.status]} bg-slate-900 p-4 transition-colors`}
        >
          <p className="text-sm font-medium">{SYSTEM_LABELS[t.system] ?? t.system}</p>
          <p className="text-xs text-slate-500 capitalize mt-1">{STATUS_LABEL[t.status]}</p>
          {t.artifact_summary && (
            <p className="text-xs text-slate-300 mt-2 truncate" title={t.artifact_summary}>
              {t.artifact_summary}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
