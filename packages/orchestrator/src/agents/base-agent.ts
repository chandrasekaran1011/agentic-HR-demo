import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { chatComplete } from "../llm/azure-openai";
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
  protected abstract readonly tools: ChatCompletionTool[];

  /**
   * Run the agent. Each call:
   *   1. flips tile to in_progress
   *   2. runs LLM loop with the agent's tools
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
   * Default implementation runs an LLM loop with the agent's tools and
   * uses the final assistant message as artifact_summary.
   * Subclasses can override for more deterministic behavior.
   */
  protected abstract execute(ctx: AgentContext, ticketId: string): Promise<AgentResult>;

  protected async runLLM(messages: ChatCompletionMessageParam[]): Promise<string> {
    const res = await chatComplete({
      messages: [{ role: "system", content: this.systemPrompt }, ...messages],
      tools: this.tools.length > 0 ? this.tools : undefined,
      maxTokens: 256,
    });
    const choice = res.choices[0];
    return (choice?.message?.content as string) ?? "ok";
  }

  protected async delay(): Promise<void> {
    const ms = parseInt(process.env.DEMO_DELAY_MS ?? "300", 10);
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  }
}
