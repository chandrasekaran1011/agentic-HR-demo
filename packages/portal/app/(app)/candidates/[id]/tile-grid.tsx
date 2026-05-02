"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Tile } from "@hr-agent/shared";
import { useSseEvents, type AgentEvent } from "@/components/use-sse-events";
import { TileActionDrawer } from "./tile-action-drawer";

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
  pending: "border-border",
  in_progress: "border-amber-500/70",
  done: "border-emerald-500/70",
  error: "border-rose-500/70",
  amending: "border-amber-500/70",
};

const STATUS_LABEL: Record<Tile["status"], string> = {
  pending: "pending",
  in_progress: "in progress",
  done: "done",
  error: "error",
  amending: "amending",
};

interface Props {
  candidateId: string;
  candidateTeam: string;
  initialTiles: Tile[];
}

export function TileGrid({ candidateId, candidateTeam, initialTiles }: Props) {
  const [tiles, setTiles] = useState<Record<string, Tile>>(() => {
    const m: Record<string, Tile> = {};
    for (const t of initialTiles) m[t.system] = t;
    return m;
  });
  const [activeTile, setActiveTile] = useState<Tile | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // On mount and periodically while any tile is in_progress/pending/amending,
  // poll the canonical state. This catches up on any events SSE missed before
  // it connected (race between cascade start and component mount).
  useEffect(() => {
    let cancelled = false;
    const fetchTiles = async () => {
      try {
        const res = await fetch(`/api/candidates/${candidateId}/tiles`);
        if (!res.ok) return;
        const data = (await res.json()) as { tiles: Tile[] };
        if (cancelled) return;
        setTiles((prev) => {
          const next = { ...prev };
          for (const t of data.tiles) next[t.system] = t;
          return next;
        });
      } catch {
        // ignore
      }
    };
    fetchTiles();
    pollingRef.current = setInterval(() => {
      const allDone = Object.values(tiles).every((t) => t.status === "done");
      if (allDone) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        return;
      }
      fetchTiles();
    }, 2000);
    return () => {
      cancelled = true;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  useSseEvents(candidateId, (event: AgentEvent) => {
    if (event.type === "tile.update" && event.system) {
      const payload = event.payload as { status: Tile["status"]; ticket_id?: string; artifact_summary?: string };
      setTiles((prev) => ({
        ...prev,
        [event.system!]: {
          candidate_id: candidateId,
          system: event.system as Tile["system"],
          status: payload.status,
          ticket_id: payload.ticket_id ?? prev[event.system!]?.ticket_id,
          artifact_summary: payload.artifact_summary ?? prev[event.system!]?.artifact_summary,
        },
      }));
    }
  });

  return (
    <>
      <div className="grid grid-cols-4 gap-4">
        {Object.values(tiles).map((t) => (
          <motion.button
            key={t.system}
            type="button"
            layout
            animate={{
              scale: t.status === "in_progress" || t.status === "amending" ? 1.02 : 1,
            }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            whileHover={{ y: -2 }}
            onClick={() => setActiveTile(t)}
            className={`text-left rounded-lg border-2 ${STATUS_RING[t.status]} bg-card hover:bg-accent/40 p-4 transition-colors cursor-pointer`}
            title="Click for actions"
          >
            <p className="text-sm font-medium">{SYSTEM_LABELS[t.system] ?? t.system}</p>
            <p
              className={`text-xs mt-1 capitalize ${
                t.status === "done"
                  ? "text-emerald-400"
                  : t.status === "in_progress" || t.status === "amending"
                  ? "text-amber-400"
                  : t.status === "error"
                  ? "text-rose-400"
                  : "text-muted-foreground"
              }`}
            >
              {STATUS_LABEL[t.status]}
            </p>
            <AnimatePresence>
              {t.artifact_summary && (
                <motion.p
                  key={t.artifact_summary}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-foreground mt-2 truncate"
                  title={t.artifact_summary}
                >
                  {t.artifact_summary}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
      </div>
      <TileActionDrawer
        candidateId={candidateId}
        candidateTeam={candidateTeam}
        tile={activeTile}
        onClose={() => setActiveTile(null)}
      />
    </>
  );
}
