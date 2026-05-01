import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const orchestratorUrl = process.env.ORCHESTRATOR_URL ?? "http://localhost:3001";

  const upstream = await fetch(`${orchestratorUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  // Forward the SSE stream verbatim
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
