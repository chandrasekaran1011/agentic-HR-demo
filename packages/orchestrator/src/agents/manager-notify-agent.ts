import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupTeam } from "../tools/master-data";
import { renderTemplate } from "../email/render";
import { sendEmail } from "../email/acs-client";
import { getCompany } from "../lib/company";

export class ManagerNotifyAgent extends BaseAgent {
  readonly system = "manager_notify" as const;
  protected readonly systemPrompt = "Manager notification agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const team = await lookupTeam(ctx.candidate.team);
    const managerEmail = team?.manager_email ?? "manager@unknown";
    const company = getCompany();

    const html = await renderTemplate("manager-notify", {
      candidate_name: ctx.candidate.name,
      role: ctx.candidate.role,
      team: ctx.candidate.team,
      joining_date: ctx.candidate.joining_date,
      manager_name: ctx.candidate.manager,
      company_name: company.name,
      brand_color: company.brandColor,
    });

    const send = await sendEmail({
      to: managerEmail,
      subject: `New joiner: ${ctx.candidate.name} — ${ctx.candidate.role} — joining ${ctx.candidate.joining_date}`,
      html,
      candidateId: ctx.candidate.id,
      runId: ctx.runId,
    });

    return {
      ticketId,
      artifactSummary: `Notified ${ctx.candidate.manager}`,
      ticketFields: {
        manager_email: managerEmail,
        channel: "email",
        sent_at: new Date().toISOString(),
        message_id: send.messageId,
      },
    };
  }
}
