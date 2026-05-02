"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CosmicOrb } from "./cosmic-orb";
import type { VoiceState } from "./voice-agent";

export interface VoiceOverlayTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface Props {
  open: boolean;
  state: VoiceState;
  turns: VoiceOverlayTurn[]; // voice-only, oldest → newest
  onEnd: () => void;
}

const STATE_LABEL: Record<VoiceState, string> = {
  idle: "ready",
  connecting: "connecting",
  listening: "listening",
  speaking: "speaking",
  thinking: "thinking",
};

/**
 * Voice mode overlay that fills its containing element (the chat sidebar),
 * NOT the full viewport. The right side of the portal stays interactive
 * during a voice call. Parent must be positioned (relative).
 */
export function VoiceOverlay({ open, state, turns, onEnd }: Props) {
  // ESC ends the call (only when overlay is open)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnd();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onEnd]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-50 flex flex-col items-center justify-between"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 50% 35%, rgba(20, 24, 50, 0.96) 0%, #04060c 70%, #02030a 100%)",
          }}
        >
          {/* Subtle starfield */}
          <Starfield />

          {/* Top — transcript (latest at top, fading) */}
          <div className="relative z-10 w-full px-6 pt-10 pb-3">
            <div className="space-y-3 min-h-[120px]">
              <AnimatePresence initial={false}>
                {[...turns]
                  .slice(-3)
                  .reverse()
                  .map((t, i) => (
                    <motion.p
                      key={t.id}
                      initial={{ opacity: 0, y: -6, filter: "blur(6px)" }}
                      animate={{
                        opacity: i === 0 ? 1 : i === 1 ? 0.5 : 0.22,
                        y: 0,
                        filter: "blur(0px)",
                      }}
                      exit={{ opacity: 0, filter: "blur(6px)" }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className={`font-display text-balance leading-snug ${
                        i === 0 ? "text-xl text-slate-50" : "text-base text-slate-300"
                      }`}
                      style={{
                        fontVariationSettings: "'opsz' 96, 'SOFT' 70, 'WONK' 0",
                        fontStyle: t.role === "assistant" ? "italic" : "normal",
                      }}
                    >
                      {t.role === "user" ? (
                        <span>{t.text}</span>
                      ) : (
                        <span>
                          <span className="text-slate-500 mr-2">—</span>
                          {t.text}
                        </span>
                      )}
                    </motion.p>
                  ))}
              </AnimatePresence>
              {turns.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.55 }}
                  className="font-display italic text-lg text-slate-400"
                  style={{ fontVariationSettings: "'opsz' 96, 'SOFT' 100" }}
                >
                  Speak whenever you&rsquo;re ready.
                </motion.p>
              )}
            </div>
          </div>

          {/* Center — orb + state caption */}
          <div className="relative z-10 flex flex-col items-center gap-5">
            <CosmicOrb state={state} size={220} />
            <motion.p
              key={state}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="font-display italic text-slate-400 text-[11px] uppercase"
              style={{
                letterSpacing: "0.4em",
                fontVariationSettings: "'opsz' 14, 'SOFT' 100",
              }}
            >
              {STATE_LABEL[state]}
            </motion.p>
          </div>

          {/* Bottom — end-call */}
          <div className="relative z-10 pb-8 flex flex-col items-center gap-2">
            <button
              onClick={onEnd}
              className="group relative size-14 rounded-full bg-rose-500/10 border border-rose-400/40 hover:bg-rose-500/20 transition-colors flex items-center justify-center backdrop-blur-sm"
              aria-label="End voice"
            >
              <X className="size-5 text-rose-300 group-hover:text-rose-100" strokeWidth={2.5} />
              <span
                className="absolute inset-0 rounded-full border border-rose-400/30 animate-ping"
                style={{ animationDuration: "2.6s" }}
              />
            </button>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-600">
              tap or esc
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Sparse starfield for atmosphere — pure CSS, no JS animation. */
function Starfield() {
  // Tuned for a narrow column. Each star pulses on its own delay.
  const stars = [
    { top: "8%", left: "18%", size: 1, delay: 0 },
    { top: "14%", left: "78%", size: 1, delay: 1.4 },
    { top: "22%", left: "30%", size: 2, delay: 0.6 },
    { top: "30%", left: "82%", size: 1, delay: 2.1 },
    { top: "44%", left: "12%", size: 1, delay: 1.1 },
    { top: "62%", left: "85%", size: 2, delay: 1.8 },
    { top: "70%", left: "20%", size: 1, delay: 0.9 },
    { top: "82%", left: "55%", size: 1, delay: 2.4 },
    { top: "5%", left: "55%", size: 1, delay: 0.4 },
    { top: "92%", left: "30%", size: 1, delay: 1.9 },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-slate-200"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            opacity: 0.7,
            boxShadow: `0 0 ${s.size * 4}px rgba(226,232,240,0.6)`,
            animation: `voice-twinkle 3.5s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes voice-twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
