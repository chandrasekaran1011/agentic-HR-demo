import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupRole, lookupSalaryBand } from "../tools/master-data";

export class PayrollAgent extends BaseAgent {
  readonly system = "payroll" as const;
  protected readonly systemPrompt = "Payroll setup agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const role = await lookupRole(ctx.candidate.role);
    const family = role?.family ?? "engineering";
    const level = role?.level ?? "senior";
    const band = await lookupSalaryBand(family, level);
    return {
      ticketId,
      artifactSummary: `Setup ${band?.band ?? "L5"}`,
      ticketFields: {
        band: band?.band ?? "L5",
        bank_status: "pending",
        pf_status: "pending",
      },
    };
  }
}
