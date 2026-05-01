import { AppShell } from "@/components/app-shell";
import { listCandidates } from "@/lib/seed-candidates";
import { CandidatesTable } from "./candidates-table";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const candidates = await listCandidates();
  return (
    <AppShell>
      <div className="p-8">
        <h1 className="text-2xl font-semibold mb-6">Candidates</h1>
        <CandidatesTable initialData={candidates} />
      </div>
    </AppShell>
  );
}
