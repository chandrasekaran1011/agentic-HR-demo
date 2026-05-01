import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getTrainingMatrix } from "@/lib/master-data-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function TrainingMatrixPage() {
  const entries = await getTrainingMatrix();
  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <Link href="/admin/master-data" className="text-sm text-slate-400 hover:text-slate-200">
          ◀ Back to master data
        </Link>
        <h1 className="text-2xl font-semibold">Training matrix</h1>
        <p className="text-sm text-slate-400">
          The Training agent enrolls every required course and may add recommended ones based on role family.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role family</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Recommended</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.role_family}>
                <TableCell className="font-medium capitalize">{e.role_family}</TableCell>
                <TableCell className="text-emerald-300">{e.required.join(", ")}</TableCell>
                <TableCell className="text-slate-400">{e.recommended.join(", ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
