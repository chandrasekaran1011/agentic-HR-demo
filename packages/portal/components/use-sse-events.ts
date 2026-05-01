"use client";

import { useEffect, useRef } from "react";

export interface AgentEvent<T = unknown> {
  type: string;
  candidate_id: string;
  system?: string;
  payload: T;
  timestamp: string;
  run_id?: string;
}

export function useSseEvents(
  candidateId: string | null,
  onEvent: (event: AgentEvent) => void
): void {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!candidateId) return;
    const url = `/api/events?candidate_id=${encodeURIComponent(candidateId)}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as AgentEvent;
        handlerRef.current(event);
      } catch {
        // ignore
      }
    };
    es.onerror = () => {
      // Browser will auto-reconnect; just log.
      // console.warn("SSE error", e);
    };
    return () => {
      es.close();
    };
  }, [candidateId]);
}
