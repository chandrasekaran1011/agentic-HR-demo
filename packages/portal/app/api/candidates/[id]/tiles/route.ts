import { NextResponse } from "next/server";
import { getTiles } from "@/lib/seed-candidates";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tiles = await getTiles(id);
  return NextResponse.json({ tiles });
}
