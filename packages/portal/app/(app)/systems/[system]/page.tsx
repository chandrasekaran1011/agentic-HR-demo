import { notFound } from "next/navigation";
import { listSystemTickets, isValidSystem } from "@/lib/system-tickets";
import { SYSTEM_CONFIG } from "@/lib/system-config";
import { SystemDashboard } from "./system-dashboard";

export const dynamic = "force-dynamic";

export default async function SystemPage({
  params,
}: {
  params: Promise<{ system: string }>;
}) {
  const { system } = await params;
  if (!isValidSystem(system)) notFound();
  const config = SYSTEM_CONFIG[system];
  const tickets = await listSystemTickets(system);
  return <SystemDashboard config={config} tickets={tickets} />;
}
