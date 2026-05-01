"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSseEvents, type AgentEvent } from "./use-sse-events";

interface Reasoning {
  id: string;
  system?: string;
  msg: string;
}

const MAX_LINES = 5;

export function ReasoningStream({ candidateId }: { candidateId: string }) {
  const [items, setItems] = useState<Reasoning[]>([]);

  useSseEvents(candidateId, (event: AgentEvent) => {
    if (event.type === "audit.append") {
      const payload = event.payload as { msg: string };
      setItems((prev) => {
        const next: Reasoning = {
          id: `${event.timestamp}-${event.system ?? "x"}`,
          system: event.system,
          msg: payload.msg,
        };
        return [next, ...prev].slice(0, MAX_LINES);
      });
    }
  });

  if (items.length === 0) {
    return <p className="text-sm text-slate-500 italic">Reasoning will appear here as agents work…</p>;
  }

  return (
    <ul className="space-y-1">
      <AnimatePresence initial={false}>
        {items.map((it, i) => (
          <motion.li
            key={it.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1 - i * 0.18, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="text-sm text-slate-300"
          >
            {it.system && (
              <span className="text-slate-500 font-mono mr-2 text-xs">[{it.system}]</span>
            )}
            {it.msg}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
