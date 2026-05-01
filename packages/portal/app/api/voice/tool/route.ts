import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const orchestratorUrl = process.env.ORCHESTRATOR_URL ?? "http://localhost:3001";
  const upstream = await fetch(`${orchestratorUrl}/voice/tool`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
