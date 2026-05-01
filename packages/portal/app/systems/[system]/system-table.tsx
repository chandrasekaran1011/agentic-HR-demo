"use client";

import type { Ticket } from "@/lib/system-tickets";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SystemTable({ tickets }: { tickets: Ticket[] }) {
  if (tickets.length === 0) {
    return <p className="text-sm text-slate-500 italic">No tickets yet.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticket</TableHead>
          <TableHead>Candidate</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Summary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((t) => (
          <TableRow key={t.ticket_id}>
            <TableCell className="font-mono text-xs">{t.ticket_id}</TableCell>
            <TableCell>{t.candidate_id}</TableCell>
            <TableCell>{t.status}</TableCell>
            <TableCell className="text-slate-300">{t.artifact_summary}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
