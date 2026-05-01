"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail } from "lucide-react";

interface ToastItem {
  id: string;
  to: string;
  subject: string;
}

export function InboxPreview({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "email.sent") {
          const id = `${event.timestamp}-${Math.random()}`;
          setItems((prev) => [{ id, to: event.payload.to, subject: event.payload.subject }, ...prev].slice(0, 3));
          setTimeout(() => {
            setItems((prev) => prev.filter((i) => i.id !== id));
          }, 8000);
        }
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
            className="bg-slate-900/95 border border-slate-700 rounded-lg p-3 w-80 shadow-2xl backdrop-blur"
          >
            <div className="flex items-start gap-3">
              <Mail className="size-5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">New email · {item.to}</p>
                <p className="text-sm text-slate-100 font-medium truncate" title={item.subject}>
                  {item.subject}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
