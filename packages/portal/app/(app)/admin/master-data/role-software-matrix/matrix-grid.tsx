"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Role, Software } from "@hr-agent/shared";
import { Check } from "lucide-react";

interface Props {
  roles: Role[];
  software: Software[];
  initialMatrix: Record<string, string[]>;
}

export function MatrixGrid({ roles, software, initialMatrix }: Props) {
  const [matrix, setMatrix] = useState<Record<string, string[]>>(initialMatrix);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(roleId: string, softwareId: string) {
    const key = `${roleId}:${softwareId}`;
    setBusy(key);
    // Optimistic update
    const current = matrix[roleId] ?? [];
    const next = current.includes(softwareId)
      ? current.filter((s) => s !== softwareId)
      : [...current, softwareId];
    setMatrix({ ...matrix, [roleId]: next });
    try {
      await fetch("/api/master-data/role-software-matrix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role_id: roleId, software_id: softwareId }),
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="text-sm border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card px-4 py-3 text-left font-medium text-muted-foreground border-b border-border min-w-[200px]">
              Role
            </th>
            {software.map((s) => (
              <th
                key={s.id}
                className="px-3 py-3 text-center font-medium text-muted-foreground border-b border-border min-w-[110px]"
                title={s.category}
              >
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => {
            const entitled = new Set(matrix[role.id] ?? []);
            return (
              <tr key={role.id} className="hover:bg-muted/30">
                <td className="sticky left-0 bg-card px-4 py-3 border-b border-border/60 font-medium">
                  {role.name}
                  <span className="block text-xs text-muted-foreground">
                    {role.family} · {role.level}
                  </span>
                </td>
                {software.map((s) => {
                  const isOn = entitled.has(s.id);
                  const key = `${role.id}:${s.id}`;
                  return (
                    <td
                      key={s.id}
                      className="text-center border-b border-border/60 p-0"
                    >
                      <button
                        type="button"
                        disabled={busy === key}
                        onClick={() => toggle(role.id, s.id)}
                        className={`w-full h-full py-3 transition-colors ${
                          isOn
                            ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300"
                            : "hover:bg-muted/40 text-muted-foreground/40"
                        }`}
                        aria-pressed={isOn}
                        title={isOn ? "Click to remove" : "Click to add"}
                      >
                        <motion.span
                          animate={{ scale: isOn ? 1 : 0, opacity: isOn ? 1 : 0 }}
                          transition={{ duration: 0.18 }}
                          className="inline-block"
                        >
                          <Check className="size-5 mx-auto" strokeWidth={3} />
                        </motion.span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
