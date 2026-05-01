import { getRedis } from "./redis";
import { SYSTEMS, type SystemName } from "@hr-agent/shared";

export interface Ticket {
  ticket_id: string;
  candidate_id: string;
  status?: string;
  artifact_summary?: string;
  [k: string]: string | undefined;
}

export function isValidSystem(s: string): s is SystemName {
  return (SYSTEMS as readonly string[]).includes(s);
}

export async function listSystemTickets(system: SystemName): Promise<Ticket[]> {
  const r = getRedis();
  const ids = await r.lrange(`system:${system}:tickets`, 0, -1);
  const tickets: Ticket[] = [];
  for (const id of ids) {
    const data = await r.hgetall(`ticket:${system}:${id}`);
    if (Object.keys(data).length > 0) tickets.push(data as Ticket);
  }
  return tickets;
}
