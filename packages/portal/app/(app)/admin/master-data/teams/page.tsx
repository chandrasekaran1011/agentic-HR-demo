import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listTeams } from "@/lib/master-data-api";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await listTeams();
  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <Link href="/admin/master-data" className="text-sm text-muted-foreground hover:text-foreground">
          ◀ Back to master data
        </Link>
        <h1 className="text-2xl font-semibold">Teams</h1>
        <div className="grid grid-cols-2 gap-4">
          {teams.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">{t.name}</h2>
                <Badge variant="outline">Floor {t.floor} · {t.wing}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Manager: <span className="text-foreground">{t.manager}</span>
                <span className="text-muted-foreground ml-2">{t.manager_email}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Parking: <Badge className="ml-1" variant="outline">{t.parking_eligibility}</Badge>
              </p>
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2">Buddy pool ({t.buddy_pool.length})</p>
                <ul className="space-y-1">
                  {t.buddy_pool.map((b) => (
                    <li key={b.email} className="text-sm flex justify-between">
                      <span>
                        {b.name}
                        <span className="text-muted-foreground ml-2">({b.role_family}, {b.tenure_years}yr)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
