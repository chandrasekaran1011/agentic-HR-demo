import { NextResponse } from "next/server";
import { listCandidates } from "@/lib/seed-candidates";

export async function GET() {
  const candidates = await listCandidates();
  return NextResponse.json({ candidates });
}
