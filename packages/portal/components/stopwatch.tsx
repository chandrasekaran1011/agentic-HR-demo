"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSseEvents, type AgentEvent } from "./use-sse-events";

const BASELINE_SECONDS = 6 * 3600 + 12 * 60; // 6h 12m manual baseline

interface State {
  startedAt: number | null;
  finishedAt: number | null;
}

function formatHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatStopwatch(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${tenths}`;
}

export function Stopwatch({ candidateId }: { candidateId: string }) {
  const [state, setState] = useState<State>({ startedAt: null, finishedAt: null });
  const [now, setNow] = useState<number>(Date.now());

  useSseEvents(candidateId, (event: AgentEvent) => {
    if (event.type === "tile.update") {
      const payload = event.payload as { status: string };
      if (payload.status === "in_progress") {
        setState((prev) =>
          prev.startedAt == null ? { startedAt: Date.now(), finishedAt: null } : prev
        );
      }
    }
    if (event.type === "cascade.complete") {
      setState((prev) => ({ ...prev, finishedAt: Date.now() }));
    }
  });

  useEffect(() => {
    if (state.startedAt == null || state.finishedAt != null) return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [state.startedAt, state.finishedAt]);

  if (state.startedAt == null) {
    return null;
  }

  const elapsedMs = (state.finishedAt ?? now) - state.startedAt;
  const elapsedSec = elapsedMs / 1000;
  const savedSec = Math.max(0, BASELINE_SECONDS - elapsedSec);

  return (
    <div className="flex flex-col items-end gap-1">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-3xl font-mono tabular-nums text-slate-100"
      >
        ⏱ {formatStopwatch(elapsedMs)}
      </motion.div>
      <motion.div
        animate={{ scale: state.finishedAt != null ? [1, 1.08, 1] : 1 }}
        transition={{ duration: 0.4 }}
        className="text-sm text-emerald-400 font-medium"
      >
        💰 {formatHMS(savedSec)} saved
      </motion.div>
    </div>
  );
}
