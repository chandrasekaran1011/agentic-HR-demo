import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listSoftware } from "@/lib/master-data-api";
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

export default async function SoftwarePage() {
  const software = await listSoftware();
  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <Link href="/admin/master-data" className="text-sm text-muted-foreground hover:text-foreground">
          ◀ Back to master data
        </Link>
        <h1 className="text-2xl font-semibold">Software catalog</h1>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {software.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs text-slate-500">{s.id}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell><Badge variant="outline">{s.category}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
