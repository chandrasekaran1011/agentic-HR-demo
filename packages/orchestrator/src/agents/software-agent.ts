import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupRole, lookupSoftwareForRole } from "../tools/master-data";

export class SoftwareAgent extends BaseAgent {
  readonly system = "software" as const;
  protected readonly systemPrompt = "Software entitlement agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const role = await lookupRole(ctx.candidate.role);
    const items = role ? await lookupSoftwareForRole(role.id) : [];
    return {
      ticketId,
      artifactSummary: `${items.length} entitlements`,
      ticketFields: {
        entitlements: items.join(","),
        role_id: role?.id ?? "unknown",
      },
    };
  }
}
