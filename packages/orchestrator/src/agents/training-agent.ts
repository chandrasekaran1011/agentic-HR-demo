import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupRole, lookupCoursesFor } from "../tools/master-data";

export class TrainingAgent extends BaseAgent {
  readonly system = "training" as const;
  protected readonly systemPrompt = "Training enrollment agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const role = await lookupRole(ctx.candidate.role);
    const family = role?.family ?? "engineering";
    const matrix = await lookupCoursesFor(family);
    const all = [...(matrix?.required ?? []), ...(matrix?.recommended ?? [])];
    return {
      ticketId,
      artifactSummary: `${all.length} enrolled`,
      ticketFields: {
        required: (matrix?.required ?? []).join(","),
        recommended: (matrix?.recommended ?? []).join(","),
      },
    };
  }
}
