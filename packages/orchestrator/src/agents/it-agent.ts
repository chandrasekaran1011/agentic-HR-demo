import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupRole, lookupLaptopFor } from "../tools/master-data";

export class ItAgent extends BaseAgent {
  readonly system = "it" as const;
  protected readonly systemPrompt = "IT laptop allocation agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const role = await lookupRole(ctx.candidate.role);
    const family = role?.family ?? "engineering";
    const level = role?.level ?? "senior";
    const laptop = await lookupLaptopFor(family, level);
    const summary = laptop ? `${laptop.model} ${laptop.ram} ${laptop.cpu}` : "MacBook Pro 16 32GB M3 Pro";
    return {
      ticketId,
      artifactSummary: summary,
      ticketFields: {
        laptop_model: laptop?.model ?? "MacBook Pro 16",
        ram: laptop?.ram ?? "32GB",
        cpu: laptop?.cpu ?? "M3 Pro",
        accessories: (laptop?.accessories ?? []).join(","),
        status: "raised",
      },
    };
  }
}
