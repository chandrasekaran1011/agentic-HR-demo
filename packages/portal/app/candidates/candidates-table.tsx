"use client";

import Link from "next/link";
import { useState } from "react";
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

const statusVariant: Record<Candidate["status"], string> = {
  pending: "bg-slate-700 text-slate-200",
  in_progress: "bg-amber-600/30 text-amber-200 border-amber-600/40",
  complete: "bg-emerald-600/30 text-emerald-200 border-emerald-600/40",
};

export function CandidatesTable({ initialData }: { initialData: Candidate[] }) {
  const [candidates] = useState<Candidate[]>(initialData);
  const router = useRouter();

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
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((c) => (
          <TableRow
            key={c.id}
            className="cursor-pointer hover:bg-slate-900/60"
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
