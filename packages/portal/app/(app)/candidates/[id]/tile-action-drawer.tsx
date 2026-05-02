"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, Mail, UserCheck, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Tile } from "@hr-agent/shared";

interface Buddy {
  name: string;
  email: string;
  role_family: string;
  tenure_years: number;
}

interface Ticket {
  ticket_id?: string;
  status?: string;
  artifact_summary?: string;
  [k: string]: string | undefined;
}

interface Props {
  candidateId: string;
  candidateTeam: string;
  tile: Tile | null;
  onClose: () => void;
}

const SYSTEM_LABEL: Record<string, string> = {
  hrms: "HRMS",
  documents: "Documents",
  buddy: "Buddy",
  it: "IT Asset",
  software: "Software",
  training: "Training",
  welcome: "Welcome Email",
  idcard: "ID Card",
  payroll: "Payroll",
  manager_notify: "Manager Notification",
  seating: "Seating",
  parking: "Parking",
};

// Systems where "re-send" makes sense (they emit an email or notification).
const NOTIFY_SYSTEMS = new Set([
  "welcome",
  "manager_notify",
  "documents",
  "buddy",
]);

export function TileActionDrawer({ candidateId, candidateTeam, tile, onClose }: Props) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // action label currently in flight
  const [flash, setFlash] = useState<string | null>(null);
  const [buddies, setBuddies] = useState<Buddy[] | null>(null);

  // Fetch the latest ticket data on open
  useEffect(() => {
    if (!tile) return;
    setTicket(null);
    setFlash(null);
    setBuddies(null);
    if (tile.ticket_id) {
      fetch(`/api/systems/${tile.system}`)
        .then((r) => r.json())
        .then((data) => {
          const found = (data.tickets ?? []).find(
            (t: Ticket) => t.ticket_id === tile.ticket_id
          );
          setTicket(found ?? null);
        })
        .catch(() => {});
    }
    if (tile.system === "buddy") {
      fetch(`/api/teams/${encodeURIComponent(candidateTeam)}/buddies`)
        .then((r) => r.json())
        .then((data) => setBuddies(data.buddies ?? []))
        .catch(() => setBuddies([]));
    }
  }, [tile, candidateTeam]);

  // ESC closes
  useEffect(() => {
    if (!tile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tile, onClose]);

  async function callRunSingle(action: string, override?: Record<string, unknown>) {
    if (!tile) return;
    setBusy(action);
    setFlash(null);
    try {
      const res = await fetch("/api/run/single", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          system: tile.system,
          override: override ?? {},
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFlash(`✓ ${action} dispatched (run ${data.run_id})`);
        // Reload the ticket after a short delay
        setTimeout(async () => {
          if (tile.ticket_id) {
            const r = await fetch(`/api/systems/${tile.system}`);
            const d = await r.json();
            const found = (d.tickets ?? []).find(
              (t: Ticket) => t.ticket_id === tile.ticket_id
            );
            if (found) setTicket(found);
          }
        }, 1500);
      } else {
        setFlash(`✗ ${data.error ?? "failed"}`);
      }
    } catch (err) {
      setFlash(`✗ ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AnimatePresence>
      {tile && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 right-0 z-50 h-screen w-full max-w-md bg-card border-l border-border flex flex-col shadow-2xl"
          >
            <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  HR Self-Service
                </p>
                <h2 className="text-xl font-semibold mt-0.5">
                  {SYSTEM_LABEL[tile.system] ?? tile.system}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  for{" "}
                  <Link
                    href={`/candidates/${candidateId}`}
                    className="hover:text-foreground"
                  >
                    {formatId(candidateId)}
                  </Link>
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-5 space-y-6">
              {/* Status snapshot */}
              <section>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Status
                </p>
                <div className="flex items-center gap-2">
                  <StatusPill status={tile.status} />
                  {tile.ticket_id && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {tile.ticket_id}
                    </span>
                  )}
                </div>
                {tile.artifact_summary && (
                  <p className="text-sm text-foreground mt-2">{tile.artifact_summary}</p>
                )}
              </section>

              {/* Ticket details */}
              {ticket && Object.keys(ticket).length > 4 && (
                <section>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Details
                  </p>
                  <dl className="space-y-1.5 text-sm">
                    {Object.entries(ticket)
                      .filter(([k]) => !["ticket_id", "status", "candidate_id", "artifact_summary"].includes(k))
                      .map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
                          <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                          <dd className="text-foreground break-words">{v ?? "—"}</dd>
                        </div>
                      ))}
                  </dl>
                </section>
              )}

              {/* Actions */}
              <section>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Actions
                </p>
                <div className="space-y-2">
                  <ActionButton
                    icon={RefreshCw}
                    label="Re-run this step"
                    description="Re-execute the agent for this ticket. Useful if the run errored or master data changed."
                    busy={busy === "rerun"}
                    onClick={() => callRunSingle("rerun")}
                  />
                  {NOTIFY_SYSTEMS.has(tile.system) && (
                    <ActionButton
                      icon={Mail}
                      label={
                        tile.system === "welcome"
                          ? "Re-send welcome email"
                          : tile.system === "manager_notify"
                          ? "Re-send manager notification"
                          : tile.system === "documents"
                          ? "Re-send document checklist"
                          : "Re-send buddy intro email"
                      }
                      description="Triggers the agent again — same recipient, same template, fresh send."
                      busy={busy === "resend"}
                      onClick={() => callRunSingle("resend")}
                    />
                  )}
                </div>
              </section>

              {/* Buddy reassign picker (buddy-only) */}
              {tile.system === "buddy" && buddies !== null && (
                <section>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                    Reassign buddy
                  </p>
                  {buddies.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No buddies in the {candidateTeam} pool.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {buddies.map((b) => {
                        const isCurrent =
                          ticket?.buddy_email?.toLowerCase() === b.email.toLowerCase();
                        return (
                          <button
                            key={b.email}
                            disabled={busy === b.email || isCurrent}
                            onClick={() =>
                              callRunSingle(b.email, { buddy_email: b.email })
                            }
                            className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                              isCurrent
                                ? "border-emerald-500/40 bg-emerald-500/5"
                                : "border-border hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <UserCheck className="size-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium">{b.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {b.email} · {b.role_family} · {b.tenure_years}yr
                                  </p>
                                </div>
                              </div>
                              {isCurrent && (
                                <span className="text-[10px] uppercase tracking-wider text-emerald-500">
                                  current
                                </span>
                              )}
                              {busy === b.email && (
                                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* Flash message */}
              {flash && (
                <p
                  className={`text-sm ${
                    flash.startsWith("✓")
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {flash}
                </p>
              )}

              {/* Drill-in to the system page */}
              {tile.ticket_id && (
                <Link
                  href={`/systems/${tile.system}`}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" /> View in {SYSTEM_LABEL[tile.system]} queue
                </Link>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function ActionButton({
  icon: Icon,
  label,
  description,
  busy,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full text-left rounded-md border border-border bg-card hover:bg-muted/40 px-3 py-2.5 transition-colors disabled:opacity-50"
    >
      <div className="flex items-start gap-3">
        {busy ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground mt-0.5 shrink-0" />
        ) : (
          <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    done: { label: "Resolved", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" },
    in_progress: { label: "In Progress", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" },
    amending: { label: "Amending", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" },
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground border-border" },
    error: { label: "Error", cls: "bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30" },
  };
  const c = config[status] ?? config.pending!;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${c.cls}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {c.label}
    </span>
  );
}

function formatId(id: string): string {
  return id
    .split("-")
    .map((p) => (p[0] ?? "").toUpperCase() + p.slice(1))
    .join(" ");
}
