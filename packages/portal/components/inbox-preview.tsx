"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, FileCheck2, FilePlus2, Sparkles, RefreshCw } from "lucide-react";

type ToastKind =
  | "email"
  | "ticket-created"
  | "ticket-resolved"
  | "ticket-amending"
  | "cascade-complete";

interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  subtitle: string;
  candidateId?: string;
}

/**
 * Live activity toaster. Subscribes to the same SSE feed the portal uses
 * for tile updates and surfaces a few high-signal events as bottom-right
 * toasts. Auto-dismiss after 6s. Max 4 stacked.
 */
export function InboxPreview({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        const toast = toToast(event);
        if (!toast) return;
        const id = `${event.timestamp}-${Math.random()}`;
        const item: ToastItem = { id, ...toast };
        setItems((prev) => [item, ...prev].slice(0, 4));
        setTimeout(() => {
          setItems((prev) => prev.filter((i) => i.id !== id));
        }, 6000);
      } catch {}
    };
    return () => es.close();
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
      <AnimatePresence>
        {items.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-card/95 border border-border rounded-lg p-3 w-80 shadow-2xl backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <ToastIcon kind={item.kind} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{item.title}</p>
                <p className="text-sm text-foreground font-medium truncate" title={item.subtitle}>
                  {item.subtitle}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  const c = {
    email: { Icon: Mail, color: "text-emerald-500 dark:text-emerald-400" },
    "ticket-created": { Icon: FilePlus2, color: "text-blue-500 dark:text-blue-400" },
    "ticket-resolved": { Icon: FileCheck2, color: "text-emerald-500 dark:text-emerald-400" },
    "ticket-amending": { Icon: RefreshCw, color: "text-amber-500 dark:text-amber-400" },
    "cascade-complete": { Icon: Sparkles, color: "text-violet-500 dark:text-violet-400" },
  }[kind];
  return <c.Icon className={`size-5 mt-0.5 shrink-0 ${c.color}`} />;
}

// Map of system slug → readable label for toast titles.
const SYSTEM_LABEL: Record<string, string> = {
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

interface IncomingEvent {
  type: string;
  candidate_id?: string;
  system?: string;
  payload?: {
    status?: string;
    ticket_id?: string;
    artifact_summary?: string;
    to?: string;
    subject?: string;
    affected?: string[];
    run_id?: string;
  };
}

function toToast(event: IncomingEvent): Omit<ToastItem, "id"> | null {
  // Email sent (existing behavior)
  if (event.type === "email.sent" && event.payload?.subject) {
    return {
      kind: "email",
      title: `New email · ${event.payload.to ?? "—"}`,
      subtitle: event.payload.subject,
      candidateId: event.candidate_id,
    };
  }
  // Ticket lifecycle — only the ones that signal real activity
  if (event.type === "tile.update" && event.system) {
    const status = event.payload?.status;
    const label = SYSTEM_LABEL[event.system] ?? event.system;
    const candidateLabel = event.candidate_id ? formatId(event.candidate_id) : "candidate";
    if (status === "in_progress") {
      return {
        kind: "ticket-created",
        title: `${label} · ticket opened`,
        subtitle: `${candidateLabel} — ${event.payload?.ticket_id ?? "in progress"}`,
        candidateId: event.candidate_id,
      };
    }
    if (status === "done") {
      return {
        kind: "ticket-resolved",
        title: `${label} · resolved`,
        subtitle:
          event.payload?.artifact_summary ??
          `${candidateLabel} — ${event.payload?.ticket_id ?? "done"}`,
        candidateId: event.candidate_id,
      };
    }
    if (status === "amending") {
      return {
        kind: "ticket-amending",
        title: `${label} · amending`,
        subtitle: `${candidateLabel} — re-running`,
        candidateId: event.candidate_id,
      };
    }
  }
  // Cascade-level events
  if (event.type === "cascade.complete") {
    const candidateLabel = event.candidate_id ? formatId(event.candidate_id) : "candidate";
    return {
      kind: "cascade-complete",
      title: "Onboarding complete",
      subtitle: `${candidateLabel} — all 12 actions done`,
      candidateId: event.candidate_id,
    };
  }
  return null;
}

function formatId(id: string): string {
  return id
    .split("-")
    .map((p) => (p[0] ?? "").toUpperCase() + p.slice(1))
    .join(" ");
}
