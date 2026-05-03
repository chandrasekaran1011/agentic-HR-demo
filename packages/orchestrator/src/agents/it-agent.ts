import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupRole, lookupLaptopFor, resolveLaptopFromHint } from "../tools/master-data";

interface ItOverride {
  // Free-text hint — exact id, exact model, brand, or fuzzy substring.
  // Examples: "dell", "Dell XPS 15", "lenovo-x1-carbon", "thinkpad".
  laptop_hint?: string;
  // Convenience aliases the agent tools also accept:
  laptop_model?: string;
  laptop_brand?: string;
}

export class ItAgent extends BaseAgent {
  readonly system = "it" as const;
  protected readonly systemPrompt = "IT laptop allocation agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const override = (ctx.subconfig ?? {}) as ItOverride;
    const hint = override.laptop_hint ?? override.laptop_model ?? override.laptop_brand;

    if (hint) {
      const picked = await resolveLaptopFromHint(hint);
      if (picked) {
        return {
          ticketId,
          artifactSummary: `${picked.brand} ${picked.model} ${picked.ram}`,
          ticketFields: {
            laptop_brand: picked.brand,
            laptop_model: picked.model,
            laptop_id: picked.id,
            ram: picked.ram,
            cpu: picked.cpu,
            accessories: picked.accessories.join(","),
            selection_reason: "manually assigned by HR",
            status: "raised",
          },
        };
      }
      // Fall through to role-default if hint didn't match anything; we still
      // want a working ticket rather than an error.
    }

    const role = await lookupRole(ctx.candidate.role);
    const family = role?.family ?? "engineering";
    const level = role?.level ?? "senior";
    const laptop = await lookupLaptopFor(family, level);
    const summary = laptop ? `${laptop.model} ${laptop.ram} ${laptop.cpu}` : "MacBook Pro 16 32GB M3 Pro";
    return {
      ticketId,
      artifactSummary: summary,
      ticketFields: {
        laptop_brand: "Apple",
        laptop_model: laptop?.model ?? "MacBook Pro 16",
        ram: laptop?.ram ?? "32GB",
        cpu: laptop?.cpu ?? "M3 Pro",
        accessories: (laptop?.accessories ?? []).join(","),
        selection_reason: `default for ${family}/${level}`,
        status: "raised",
      },
    };
  }
}
