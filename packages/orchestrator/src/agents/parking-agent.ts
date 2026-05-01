import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupTeam } from "../tools/master-data";

export class ParkingAgent extends BaseAgent {
  readonly system = "parking" as const;
  protected readonly systemPrompt = "Parking allocation agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const team = await lookupTeam(ctx.candidate.team);
    const eligible = team?.parking_eligibility !== "none";
    if (!eligible) {
      return {
        ticketId,
        artifactSummary: "not eligible",
        ticketFields: { status: "denied", reason: "team_policy" },
      };
    }
    const slot = `P${Math.floor(Math.random() * 3) + 1}-${String(Math.floor(Math.random() * 90) + 10)}`;
    return {
      ticketId,
      artifactSummary: slot,
      ticketFields: { slot, vehicle_type: "4-wheeler" },
    };
  }
}
