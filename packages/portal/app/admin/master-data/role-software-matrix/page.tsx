import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listRoles, listSoftware, getRoleSoftwareMatrix } from "@/lib/master-data-api";
import { MatrixGrid } from "./matrix-grid";

export const dynamic = "force-dynamic";

export default async function RoleSoftwareMatrixPage() {
  const [roles, software, matrix] = await Promise.all([
    listRoles(),
    listSoftware(),
    getRoleSoftwareMatrix(),
  ]);

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <Link href="/admin/master-data" className="text-sm text-slate-400 hover:text-slate-200">
          ◀ Back to master data
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Role × Software entitlements</h1>
          <p className="text-sm text-slate-400 mt-1">
            Click any cell to toggle. The Software agent reads this matrix when provisioning a new joiner.
          </p>
        </div>
        <MatrixGrid roles={roles} software={software} initialMatrix={matrix} />
      </div>
    </AppShell>
  );
}
