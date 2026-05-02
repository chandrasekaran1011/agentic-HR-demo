"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Candidate } from "@hr-agent/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSseEvents, type AgentEvent } from "@/components/use-sse-events";

const statusVariant: Record<Candidate["status"], string> = {
  pending: "bg-muted text-foreground",
  in_progress: "bg-amber-600/30 text-amber-200 border-amber-600/40",
  complete: "bg-emerald-600/30 text-emerald-200 border-emerald-600/40",
};

export function CandidatesTable({ initialData }: { initialData: Candidate[] }) {
  const [candidates, setCandidates] = useState<Candidate[]>(initialData);
  const [busy, setBusy] = useState<string | null>(null);
  const router = useRouter();

  // Subscribe to all candidate.update events (no candidate_id filter)
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as AgentEvent;
        if (event.type === "candidate.update") {
          const payload = event.payload as { progress?: number; status?: Candidate["status"] };
          setCandidates((prev) =>
            prev.map((c) =>
              c.id === event.candidate_id
                ? { ...c, progress: payload.progress ?? c.progress, status: payload.status ?? c.status }
                : c
            )
          );
        }
      } catch {}
    };
    return () => es.close();
  }, []);

  async function onboard(c: Candidate, e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(c.id);
    await fetch("/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        candidate: {
          id: c.id,
          name: c.name,
          email: c.email,
          role: c.role,
          team: c.team,
          manager: c.manager,
          joining_date: c.joining_date,
          current_city: c.current_city,
          photo_url: c.photo_url,
        },
      }),
    });
    setBusy(null);
    router.push(`/candidates/${c.id}`);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>Joining</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((c) => (
          <TableRow
            key={c.id}
            className="cursor-pointer hover:bg-card/70"
            onClick={() => router.push(`/candidates/${c.id}`)}
          >
            <TableCell>
              <Link href={`/candidates/${c.id}`} className="font-medium">
                {c.name}
              </Link>
            </TableCell>
            <TableCell>{c.role}</TableCell>
            <TableCell>{c.team}</TableCell>
            <TableCell>{c.joining_date}</TableCell>
            <TableCell>
              <Badge className={statusVariant[c.status]}>
                {c.status.replace("_", " ")}
              </Badge>
            </TableCell>
            <TableCell>{c.progress}/12</TableCell>
            <TableCell>
              {c.status === "pending" && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === c.id}
                  onClick={(e) => onboard(c, e)}
                  title="Manual fallback — prefer the chat or voice agent"
                >
                  {busy === c.id ? "Starting…" : "Onboard manually"}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
