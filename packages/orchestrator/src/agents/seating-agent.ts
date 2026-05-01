import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupTeam } from "../tools/master-data";

export class SeatingAgent extends BaseAgent {
  readonly system = "seating" as const;
  protected readonly systemPrompt = "Seating allocation agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const team = await lookupTeam(ctx.candidate.team);
    const floor = team?.floor ?? 3;
    const wing = (team?.wing ?? "east").toUpperCase()[0];
    const desk = Math.floor(Math.random() * 30) + 1;
    const code = `F${floor}-${wing}-${String(desk).padStart(2, "0")}`;
    return {
      ticketId,
      artifactSummary: code,
      ticketFields: { floor: String(floor), wing: team?.wing ?? "east", desk_code: code },
    };
  }
}
