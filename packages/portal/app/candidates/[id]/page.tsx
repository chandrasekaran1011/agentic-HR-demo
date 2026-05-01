import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCandidate, getTiles, getAudit } from "@/lib/seed-candidates";
import { ProfileHeader } from "./profile-header";
import { TileGrid } from "./tile-grid";
import { AuditTrail } from "./audit-trail";

export const dynamic = "force-dynamic";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [candidate, tiles, audit] = await Promise.all([
    getCandidate(id),
    getTiles(id),
    getAudit(id),
  ]);
  if (!candidate) notFound();

  return (
    <AppShell>
      <div className="p-8 space-y-8">
        <Link href="/candidates" className="text-sm text-slate-400 hover:text-slate-200">
          ◀ Back to candidates
        </Link>
        <ProfileHeader candidate={candidate} />
        <TileGrid tiles={tiles} />
        <div>
          <h2 className="text-lg font-semibold mb-4">Audit trail</h2>
          <AuditTrail entries={audit} />
        </div>
      </div>
    </AppShell>
  );
}
