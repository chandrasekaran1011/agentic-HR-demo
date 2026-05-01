import { NextResponse } from "next/server";
import { getAudit } from "@/lib/seed-candidates";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit = await getAudit(id);
  return NextResponse.json({ audit });
}
