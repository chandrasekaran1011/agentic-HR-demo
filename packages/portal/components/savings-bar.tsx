"use client";

import { motion } from "framer-motion";

export function SavingsBar({ percent }: { percent: number }) {
  return (
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${percent}%` }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300"
    />
  );
}
