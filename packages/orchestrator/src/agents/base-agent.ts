import { commitSystemAction, generateTicketId } from "../tools/ticket-helpers";
import type { Candidate, SystemName } from "@hr-agent/shared";

export interface AgentContext {
  candidate: Candidate;
  subconfig: unknown;
  runId: string;
}

export interface AgentResult {
  ticketId: string;
  artifactSummary: string;
  ticketFields: Record<string, string>;
}

export abstract class BaseAgent {
  abstract readonly system: SystemName;
  protected abstract readonly systemPrompt: string;
  protected abstract readonly tools: unknown[];

  /**
   * Run the agent. Each call:
   *   1. flips tile to in_progress
   *   2. executes the system-specific work (deterministic in Phase 2)
   *   3. flips tile to done with the artifact summary
   * On error: tile flips to "error".
   */
  async run(ctx: AgentContext): Promise<void> {
    const ticketId = await generateTicketId(this.system);
    await commitSystemAction({
      candidateId: ctx.candidate.id,
      system: this.system,
      status: "in_progress",
      runId: ctx.runId,
    });

    try {
      const result = await this.execute(ctx, ticketId);
      await this.delay();
      await commitSystemAction({
        candidateId: ctx.candidate.id,
        system: this.system,
        status: "done",
        ticketId: result.ticketId,
        artifactSummary: result.artifactSummary,
        ticketFields: result.ticketFields,
        auditMsg: result.artifactSummary,
        runId: ctx.runId,
      });
    } catch (err) {
      console.error(`[${this.system}] error`, err);
      await commitSystemAction({
        candidateId: ctx.candidate.id,
        system: this.system,
        status: "error",
        artifactSummary: "failed",
        auditMsg: `failed: ${(err as Error).message}`,
        runId: ctx.runId,
      });
    }
  }

  /**
   * Subclass-defined work. Returns the artifact details to commit.
   */
  protected abstract execute(ctx: AgentContext, ticketId: string): Promise<AgentResult>;

  protected async delay(): Promise<void> {
    const ms = parseInt(process.env.DEMO_DELAY_MS ?? "300", 10);
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }
}
