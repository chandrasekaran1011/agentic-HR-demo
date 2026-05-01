import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { listSystemTickets, isValidSystem } from "@/lib/system-tickets";
import { SystemTable } from "./system-table";

const SYSTEM_LABELS: Record<string, string> = {
  hrms: "HRMS",
  documents: "Documents",
  buddy: "Buddy",
  it: "IT Asset Tickets",
  software: "Software Provisioning",
  training: "Training Enrollments",
  welcome: "Welcome Notifications",
  idcard: "ID Card Requests",
  payroll: "Payroll",
  manager_notify: "Manager Notifications",
  seating: "Seating Allocations",
  parking: "Parking Allocations",
};

export const dynamic = "force-dynamic";

export default async function SystemPage({
  params,
}: {
  params: Promise<{ system: string }>;
}) {
  const { system } = await params;
  if (!isValidSystem(system)) notFound();
  const tickets = await listSystemTickets(system);
  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-semibold">{SYSTEM_LABELS[system] ?? system}</h1>
        <SystemTable tickets={tickets} />
      </div>
    </AppShell>
  );
}
