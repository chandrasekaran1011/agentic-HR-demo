"use client";

import { motion } from "framer-motion";
import type { VoiceState } from "./voice-agent";

interface Props {
  state: VoiceState;
  size?: number;
}

/**
 * A luminous cosmic orb that responds to voice state.
 * Layered conic gradients rotate at different speeds, blurred and
 * blended, with a slow breathing scale loop. Pure CSS + Framer Motion —
 * no audio reactivity (yet).
 *
 * State affects palette + animation tempo:
 *   listening → cool blues, slow breath
 *   speaking  → warm violets/magentas, faster pulse
 *   thinking  → amber accent, gentle wobble
 *   connecting → muted, subtle drift
 *   idle      → dim, almost still
 */
export function CosmicOrb({ state, size = 320 }: Props) {
  const config = STATE_CONFIG[state];

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* outermost halo: barely visible glow */}
      <motion.div
        className="absolute inset-0 rounded-full opacity-30"
        style={{
          background: `radial-gradient(circle, ${config.glow} 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: config.breathS, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* middle ring: slow conic, large blur */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${config.colors.join(", ")}, ${config.colors[0]})`,
          filter: "blur(28px)",
          mixBlendMode: "screen",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: config.outerSpinS, repeat: Infinity, ease: "linear" }}
      />

      {/* inner core: counter-rotating, sharper, smaller */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: "20%",
          background: `conic-gradient(from 180deg, ${[...config.colors].reverse().join(", ")}, ${[...config.colors].reverse()[0]})`,
          filter: "blur(14px)",
          mixBlendMode: "screen",
        }}
        animate={{
          rotate: -360,
          scale: [1, 1.04, 1],
        }}
        transition={{
          rotate: { duration: config.innerSpinS, repeat: Infinity, ease: "linear" },
          scale: { duration: config.breathS / 1.2, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {/* tight core: highlight that gives the orb a "wet" look */}
      <motion.div
        className="absolute rounded-full"
        style={{
          inset: "38%",
          background: `radial-gradient(circle at 30% 30%, ${config.highlight}, transparent 70%)`,
          filter: "blur(6px)",
          mixBlendMode: "screen",
        }}
        animate={{ rotate: 360, scale: [1, 1.06, 1] }}
        transition={{
          rotate: { duration: 18, repeat: Infinity, ease: "linear" },
          scale: { duration: config.breathS / 1.5, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      {/* outer thin ring — only on listening/speaking, suggests focus */}
      {(state === "listening" || state === "speaking") && (
        <motion.div
          className="absolute inset-0 rounded-full border"
          style={{
            borderColor: `${config.glow}40`,
            mixBlendMode: "screen",
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.8, 0.2, 0.8] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

interface StateConfig {
  colors: string[];
  highlight: string;
  glow: string;
  outerSpinS: number;
  innerSpinS: number;
  breathS: number;
}

const STATE_CONFIG: Record<VoiceState, StateConfig> = {
  idle: {
    colors: ["#1e1b4b", "#312e81", "#1e3a8a", "#1e1b4b"],
    highlight: "#a5b4fc",
    glow: "#6366f1",
    outerSpinS: 30,
    innerSpinS: 36,
    breathS: 6,
  },
  connecting: {
    colors: ["#3b82f6", "#6366f1", "#8b5cf6", "#3b82f6"],
    highlight: "#bae6fd",
    glow: "#60a5fa",
    outerSpinS: 12,
    innerSpinS: 16,
    breathS: 4,
  },
  listening: {
    colors: ["#0891b2", "#3b82f6", "#6366f1", "#22d3ee", "#0891b2"],
    highlight: "#e0f2fe",
    glow: "#22d3ee",
    outerSpinS: 18,
    innerSpinS: 24,
    breathS: 4.5,
  },
  speaking: {
    colors: ["#7c3aed", "#ec4899", "#f97316", "#fcd34d", "#7c3aed"],
    highlight: "#fce7f3",
    glow: "#ec4899",
    outerSpinS: 6,
    innerSpinS: 9,
    breathS: 1.8,
  },
  thinking: {
    colors: ["#f59e0b", "#a16207", "#7c2d12", "#f59e0b"],
    highlight: "#fed7aa",
    glow: "#fbbf24",
    outerSpinS: 14,
    innerSpinS: 22,
    breathS: 3,
  },
};
