import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ team: string }> }
) {
  const { team } = await params;
  const orchestratorUrl = process.env.ORCHESTRATOR_URL ?? "http://localhost:3001";
  const upstream = await fetch(
    `${orchestratorUrl}/teams/${encodeURIComponent(team)}/buddies`
  );
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
