import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupRole } from "../tools/master-data";

export class HrmsAgent extends BaseAgent {
  readonly system = "hrms" as const;
  protected readonly systemPrompt = "HRMS agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const role = await lookupRole(ctx.candidate.role);
    const dept = role?.family ?? "general";
    return {
      ticketId,
      artifactSummary: ticketId,
      ticketFields: {
        emp_id: ticketId,
        department: dept,
        designation: ctx.candidate.role,
        joining_date: ctx.candidate.joining_date,
      },
    };
  }
}
