import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupTeam } from "../tools/master-data";

interface BuddyOverride {
  buddy_email?: string;
  buddy_name?: string;
}

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

    // Honor an explicit override if HR re-assigned via the portal:
    //   subconfig: { buddy_email: "..." }   (preferred — match in pool)
    //   subconfig: { buddy_name: "..." }    (fallback)
    // Otherwise fall back to the heuristic: highest-tenure peer.
    const override = (ctx.subconfig ?? {}) as BuddyOverride;
    let buddy = pool[0]!;
    if (override.buddy_email) {
      const m = pool.find((b) => b.email.toLowerCase() === override.buddy_email!.toLowerCase());
      if (m) buddy = m;
    } else if (override.buddy_name) {
      const m = pool.find((b) => b.name.toLowerCase() === override.buddy_name!.toLowerCase());
      if (m) buddy = m;
    } else {
      buddy = [...pool].sort((a, b) => b.tenure_years - a.tenure_years)[0]!;
    }

    const reason = override.buddy_email || override.buddy_name
      ? "manually assigned by HR"
      : `${buddy.tenure_years}yr tenure, ${buddy.role_family}`;

    return {
      ticketId,
      artifactSummary: `${buddy.name} (${buddy.tenure_years}yr, ${buddy.role_family})`,
      ticketFields: {
        buddy_name: buddy.name,
        buddy_email: buddy.email,
        team: ctx.candidate.team,
        selection_reason: reason,
      },
    };
  }
}
