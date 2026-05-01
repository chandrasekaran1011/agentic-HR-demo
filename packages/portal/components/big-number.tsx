"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { formatHM, formatDuration } from "@/lib/format";

type Formatter = "integer" | "hm" | "duration";

const FORMATTERS: Record<Formatter, (n: number) => string> = {
  integer: (n) => Math.round(n).toString(),
  hm: formatHM,
  duration: formatDuration,
};

interface Props {
  value: number;
  format?: Formatter;
  durationMs?: number;
  className?: string;
}

export function BigNumber({ value, format = "integer", durationMs = 1500, className }: Props) {
  const fn = FORMATTERS[format];
  const mv = useMotionValue(0);
  const display = useTransform(mv, (n) => fn(n));
  const [text, setText] = useState<string>(fn(0));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: durationMs / 1000,
      ease: "easeOut",
    });
    const unsub = display.on("change", (v) => setText(v));
    return () => {
      controls.stop();
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, format]);

  return <motion.div className={className}>{text}</motion.div>;
}
