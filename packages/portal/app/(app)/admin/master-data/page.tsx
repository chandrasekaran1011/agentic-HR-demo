import { AppShell } from "@/components/app-shell";
import Link from "next/link";

const SECTIONS = [
  { href: "/admin/master-data/roles", title: "Roles", desc: "Job titles + role family + level" },
  { href: "/admin/master-data/software", title: "Software catalog", desc: "All software the org licenses" },
  { href: "/admin/master-data/role-software-matrix", title: "Role × Software matrix", desc: "Which roles get which software entitlements", featured: true },
  { href: "/admin/master-data/training-matrix", title: "Training matrix", desc: "Required + recommended courses per role family" },
  { href: "/admin/master-data/teams", title: "Teams", desc: "Floor, manager, buddy pool, parking eligibility" },
];

export default function MasterDataIndex() {
  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-semibold">Master Data</h1>
        <p className="text-sm text-muted-foreground">
          The agent's decisions are grounded in this master data. Edit a row and the next cascade applies it.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`rounded-lg border p-5 hover:bg-card/70 transition-colors ${
                s.featured
                  ? "border-amber-400 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium">{s.title}</h2>
                {s.featured && (
                  <span className="text-xs bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 rounded px-2 py-0.5">★ key screen</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
