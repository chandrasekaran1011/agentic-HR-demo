import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupTeam } from "../tools/master-data";

export class BuddyAgent extends BaseAgent {
  readonly system = "buddy" as const;
  protected readonly systemPrompt = "Buddy assignment agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const team = await lookupTeam(ctx.candidate.team);
    const pool = team?.buddy_pool ?? [];
    if (pool.length === 0) {
      return {
        ticketId,
        artifactSummary: "no buddy pool available",
        ticketFields: { team: ctx.candidate.team, status: "no_pool" },
      };
    }
    // Pick highest tenure
    const buddy = [...pool].sort((a, b) => b.tenure_years - a.tenure_years)[0]!;
    return {
      ticketId,
      artifactSummary: `${buddy.name} (${buddy.tenure_years}yr, ${buddy.role_family})`,
      ticketFields: {
        buddy_name: buddy.name,
        buddy_email: buddy.email,
        team: ctx.candidate.team,
        selection_reason: `${buddy.tenure_years}yr tenure, ${buddy.role_family}`,
      },
    };
  }
}
