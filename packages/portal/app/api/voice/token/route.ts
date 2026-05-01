import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const orchestratorUrl = process.env.ORCHESTRATOR_URL ?? "http://localhost:3001";
  const upstream = await fetch(`${orchestratorUrl}/voice/session`);
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
