import { getRedis } from "./redis";
import type { AgentEvent } from "@hr-agent/shared";

export const AGENT_EVENTS_CHANNEL = "agent:events";

export async function publishAgentEvent(event: AgentEvent): Promise<void> {
  const r = getRedis();
  await r.publish(AGENT_EVENTS_CHANNEL, JSON.stringify(event));
}
