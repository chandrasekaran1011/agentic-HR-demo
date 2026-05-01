import { NextRequest } from "next/server";
import { getSubscriber } from "@/lib/redis-pubsub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHANNEL = "agent:events";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const candidateFilter = url.searchParams.get("candidate_id");

  const sub = getSubscriber();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      const onMessage = (channel: string, message: string) => {
        if (channel !== CHANNEL) return;
        try {
          const event = JSON.parse(message);
          if (candidateFilter && event.candidate_id !== candidateFilter) return;
          controller.enqueue(enc.encode(`data: ${message}\n\n`));
        } catch {
          // ignore malformed
        }
      };

      sub.on("message", onMessage);
      await sub.subscribe(CHANNEL);

      // Heartbeat every 15s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      // Cleanup on disconnect
      req.signal.addEventListener("abort", async () => {
        clearInterval(heartbeat);
        sub.off("message", onMessage);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
