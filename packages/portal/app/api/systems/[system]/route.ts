import { NextResponse } from "next/server";
import { listSystemTickets, isValidSystem } from "@/lib/system-tickets";

export async function GET(_req: Request, { params }: { params: Promise<{ system: string }> }) {
  const { system } = await params;
  if (!isValidSystem(system)) {
    return NextResponse.json({ error: "Unknown system" }, { status: 404 });
  }
  const tickets = await listSystemTickets(system);
  return NextResponse.json({ tickets });
}
