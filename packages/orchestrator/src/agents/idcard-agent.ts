import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";

export class IdCardAgent extends BaseAgent {
  readonly system = "idcard" as const;
  protected readonly systemPrompt = "ID card request agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    return {
      ticketId,
      artifactSummary: "Photo session scheduled day 1",
      ticketFields: {
        type: "standard",
        photo_status: "scheduled",
        joining_date: ctx.candidate.joining_date,
      },
    };
  }
}
