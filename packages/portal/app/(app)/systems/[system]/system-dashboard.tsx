"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ChevronRight, Plus } from "lucide-react";
import type { Ticket } from "@/lib/system-tickets";
import type { SystemConfig, ColumnDef, DetailField } from "@/lib/system-config";
import { SYSTEM_ICONS } from "./system-icons";

interface Props {
  config: SystemConfig;
  tickets: Ticket[];
}

type FilterKey = "all" | "done" | "in_progress" | "pending";

export function SystemDashboard({ config, tickets }: Props) {
  const Icon = SYSTEM_ICONS[config.icon];
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Ticket | null>(null);

  const counts = useMemo(() => {
    let done = 0,
      inProgress = 0,
      pending = 0,
      errors = 0;
    for (const t of tickets) {
      const s = t.status ?? "";
      if (s === "done") done++;
      else if (s === "in_progress" || s === "amending") inProgress++;
      else if (s === "error" || s === "failed") errors++;
      else pending++;
    }
    return { total: tickets.length, done, in_progress: inProgress, pending, errors };
  }, [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      // status filter
      if (filter === "done" && t.status !== "done") return false;
      if (filter === "in_progress" && !["in_progress", "amending"].includes(t.status ?? "")) return false;
      if (filter === "pending" && (t.status === "done" || t.status === "in_progress" || t.status === "amending")) return false;
      // search
      if (search) {
        const q = search.toLowerCase();
        const hay = JSON.stringify(t).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, filter, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Hero header */}
      <div
        className={`relative overflow-hidden border-b border-border bg-gradient-to-br ${config.toneFrom} ${config.toneTo}`}
      >
        <div className="relative px-8 pt-6 pb-5">
          <div className="text-xs text-muted-foreground mb-2">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span className="mx-2 text-muted-foreground/70">/</span>
            <Link href="/" className="hover:text-foreground">Systems</Link>
            <span className="mx-2 text-muted-foreground/70">/</span>
            <span className="text-foreground">{config.label}</span>
          </div>
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-xl bg-card/90 backdrop-blur border border-border grid place-items-center">
                {Icon && <Icon className="size-6 text-foreground" strokeWidth={1.6} />}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{config.label}</h1>
                <p className="text-sm text-foreground/80 mt-1">{config.description}</p>
                <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                  Ticket prefix: {config.prefix}-YYYY-####
                </p>
              </div>
            </div>
            <button
              className="flex items-center gap-2 rounded-lg border border-border bg-card/90 backdrop-blur px-4 py-2 text-sm hover:bg-muted transition-colors"
              title="Manual ticket creation (the agent normally creates these)"
            >
              <Plus className="size-4" /> New ticket
            </button>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="px-8 pt-6 grid grid-cols-4 gap-3">
        {config.stats.map((s) => (
          <div
            key={s.key}
            className="rounded-lg border border-border bg-card/60 px-4 py-3"
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 tabular-nums ${
              s.key === "done" ? "text-emerald-700 dark:text-emerald-400" :
              s.key === "in_progress" ? "text-amber-700 dark:text-amber-400" :
              s.key === "errors" ? "text-rose-700 dark:text-rose-400" :
              "text-foreground"
            }`}>
              {counts[s.key as keyof typeof counts]}
            </p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="px-8 pt-4 pb-3 flex items-center gap-2 flex-wrap">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} count={counts.total}>
          All
        </FilterChip>
        <FilterChip
          active={filter === "in_progress"}
          onClick={() => setFilter("in_progress")}
          count={counts.in_progress}
          tone="amber"
        >
          In progress
        </FilterChip>
        <FilterChip
          active={filter === "done"}
          onClick={() => setFilter("done")}
          count={counts.done}
          tone="emerald"
        >
          Resolved
        </FilterChip>
        <FilterChip
          active={filter === "pending"}
          onClick={() => setFilter("pending")}
          count={counts.pending}
        >
          Pending
        </FilterChip>

        <div className="ml-auto relative">
          <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="rounded-md border border-border bg-card/50 pl-9 pr-3 py-1.5 text-sm w-64 focus:outline-none focus:border-input"
          />
        </div>
      </div>

      {/* Table */}
      <div className="px-8 pb-8 flex-1 min-h-0">
        <div className="rounded-lg border border-border bg-card/50 overflow-auto h-full">
          <table className="w-full text-sm">
            <thead className="bg-card/90 sticky top-0">
              <tr className="border-b border-border">
                {config.columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground ${c.width ?? ""}`}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={config.columns.length + 1}
                    className="px-4 py-12 text-center text-muted-foreground italic"
                  >
                    {tickets.length === 0
                      ? "No tickets yet. The agent creates tickets when it onboards a candidate."
                      : "No tickets match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr
                    key={t.ticket_id}
                    onClick={() => setActive(t)}
                    className="border-b border-border/60 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    {config.columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 align-middle">
                        <Cell column={c} ticket={t} />
                      </td>
                    ))}
                    <td className="pr-4 text-muted-foreground/70">
                      <ChevronRight className="size-4" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-in detail drawer */}
      <AnimatePresence>
        {active && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setActive(null)}
            />
            <motion.aside
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 z-50 h-screen w-full max-w-xl bg-background border-l border-border flex flex-col shadow-2xl"
            >
              <div
                className={`relative px-6 py-5 border-b border-border bg-gradient-to-br ${config.toneFrom} ${config.toneTo}`}
              >
                <button
                  onClick={() => setActive(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="size-5 text-muted-foreground" />
                </button>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  {config.label}
                </p>
                <p className="font-mono text-lg text-foreground">{active.ticket_id}</p>
                {active.candidate_id && (
                  <Link
                    href={`/candidates/${active.candidate_id}`}
                    className="inline-flex items-center gap-1 text-sm text-foreground mt-2 hover:text-foreground underline-offset-4 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    For {active.candidate_id}
                    <ChevronRight className="size-3" />
                  </Link>
                )}
              </div>
              <div className="flex-1 overflow-auto px-6 py-5">
                <dl className="space-y-4">
                  {config.detailFields.map((f) => (
                    <DetailRow key={f.key} field={f} ticket={active} />
                  ))}
                </dl>

                {/* Activity timeline placeholder */}
                <div className="mt-8 pt-6 border-t border-border">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                    Activity
                  </p>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="size-7 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-300 grid place-items-center text-xs font-medium shrink-0">
                        AG
                      </div>
                      <div>
                        <p className="text-sm text-foreground">Agent created the ticket</p>
                        <p className="text-xs text-muted-foreground mt-0.5">via cascade run</p>
                      </div>
                    </div>
                    {active.status === "done" && (
                      <div className="flex gap-3">
                        <div className="size-7 rounded-full bg-blue-100 border border-blue-300 text-blue-800 dark:bg-blue-500/20 dark:border-blue-500/40 dark:text-blue-300 grid place-items-center text-xs font-medium shrink-0">
                          ✓
                        </div>
                        <div>
                          <p className="text-sm text-foreground">Resolved</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{active.artifact_summary}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────

function FilterChip({
  active,
  count,
  children,
  onClick,
  tone,
}: {
  active: boolean;
  count: number;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "amber" | "emerald";
}) {
  const toneClasses =
    tone === "amber"
      ? "data-[active=true]:bg-amber-100 data-[active=true]:border-amber-400 data-[active=true]:text-amber-800 dark:data-[active=true]:bg-amber-500/20 dark:data-[active=true]:border-amber-500/40 dark:data-[active=true]:text-amber-200"
      : tone === "emerald"
      ? "data-[active=true]:bg-emerald-100 data-[active=true]:border-emerald-400 data-[active=true]:text-emerald-800 dark:data-[active=true]:bg-emerald-500/20 dark:data-[active=true]:border-emerald-500/40 dark:data-[active=true]:text-emerald-200"
      : "data-[active=true]:bg-muted data-[active=true]:text-foreground";
  return (
    <button
      data-active={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors ${toneClasses}`}
    >
      {children}
      <span className="text-[10px] tabular-nums">{count}</span>
    </button>
  );
}

function Cell({ column, ticket }: { column: ColumnDef; ticket: Ticket }) {
  const raw = ticket[column.key];
  switch (column.kind) {
    case "ticket-id":
      return (
        <span className="font-mono text-xs text-foreground">{raw ?? "—"}</span>
      );
    case "candidate":
      return (
        <Link
          href={`/candidates/${raw}`}
          className="text-foreground hover:text-foreground hover:underline underline-offset-4"
          onClick={(e) => e.stopPropagation()}
        >
          {formatCandidateName(raw ?? "")}
        </Link>
      );
    case "status":
      return <StatusPill status={ticket.status ?? "—"} />;
    case "code":
      return <span className="font-mono text-xs text-foreground">{raw ?? "—"}</span>;
    case "list":
      return <span className="text-foreground text-xs truncate block max-w-xs" title={raw}>{raw ?? "—"}</span>;
    case "value-set": {
      if (!raw) return <span className="text-muted-foreground">—</span>;
      const items = String(raw).split(/,\s*/).slice(0, 3);
      const more = String(raw).split(/,\s*/).length - items.length;
      return (
        <div className="flex flex-wrap gap-1">
          {items.map((i) => (
            <span
              key={i}
              className="rounded bg-muted/80 border border-border px-1.5 py-0.5 text-[11px] text-foreground"
            >
              {i}
            </span>
          ))}
          {more > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              +{more}
            </span>
          )}
        </div>
      );
    }
    case "text":
    default:
      return <span className="text-foreground">{raw ?? "—"}</span>;
  }
}

function StatusPill({ status }: { status: string }) {
  const emerald =
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30";
  const amber =
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30";
  const rose =
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30";
  const neutral = "bg-muted/40 text-foreground border-border";
  const config: Record<string, { label: string; cls: string }> = {
    done: { label: "Resolved", cls: emerald },
    in_progress: { label: "In Progress", cls: amber },
    amending: { label: "Amending", cls: amber },
    pending: { label: "Pending", cls: neutral },
    error: { label: "Error", cls: rose },
    failed: { label: "Failed", cls: rose },
    delivered: { label: "Delivered", cls: emerald },
    issued: { label: "Issued", cls: emerald },
  };
  const c = config[status] ?? { label: status || "—", cls: neutral };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${c.cls}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {c.label}
    </span>
  );
}

function DetailRow({ field, ticket }: { field: DetailField; ticket: Ticket }) {
  const raw = ticket[field.key];
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 items-start">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground pt-0.5">
        {field.label}
      </dt>
      <dd className="text-sm text-foreground">
        {field.kind === "list" && raw ? (
          <ul className="space-y-1">
            {String(raw)
              .split(/,\s*/)
              .map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-muted-foreground/70 mt-1.5 text-[8px]">●</span>
                  <span>{item}</span>
                </li>
              ))}
          </ul>
        ) : field.kind === "code" ? (
          <span className="font-mono text-foreground bg-card border border-border rounded px-2 py-0.5 text-xs">
            {raw ?? "—"}
          </span>
        ) : field.kind === "email" && raw ? (
          <a
            href={`mailto:${raw}`}
            className="text-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {raw}
          </a>
        ) : (
          <span>{raw ?? <span className="text-muted-foreground">—</span>}</span>
        )}
      </dd>
    </div>
  );
}

function formatCandidateName(id: string): string {
  return id
    .split("-")
    .map((p) => p[0]?.toUpperCase() + p.slice(1))
    .join(" ");
}
