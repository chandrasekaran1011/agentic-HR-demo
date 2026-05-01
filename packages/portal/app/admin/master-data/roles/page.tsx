import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listRoles } from "@/lib/master-data-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const roles = await listRoles();
  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <Link href="/admin/master-data" className="text-sm text-slate-400 hover:text-slate-200">
          ◀ Back to master data
        </Link>
        <h1 className="text-2xl font-semibold">Roles</h1>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Family</TableHead>
              <TableHead>Level</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs text-slate-500">{r.id}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="outline">{r.family}</Badge></TableCell>
                <TableCell><Badge variant="outline">{r.level}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
