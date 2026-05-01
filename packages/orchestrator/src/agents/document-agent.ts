import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupDocumentsFor } from "../tools/master-data";

export class DocumentAgent extends BaseAgent {
  readonly system = "documents" as const;
  protected readonly systemPrompt = "Document collection agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const checklist = await lookupDocumentsFor("IN", "fulltime");
    const docs = checklist?.documents ?? [];
    return {
      ticketId,
      artifactSummary: `0/${docs.length} received — checklist sent`,
      ticketFields: {
        candidate_email: ctx.candidate.email,
        documents: docs.join(","),
        sent_at: new Date().toISOString(),
      },
    };
  }
}
