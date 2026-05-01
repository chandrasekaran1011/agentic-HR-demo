import { BaseAgent, type AgentContext, type AgentResult } from "./base-agent";
import { lookupTeam, lookupRole, lookupSoftwareForRole, lookupSoftwareCatalogEntry, lookupDocumentsFor } from "../tools/master-data";
import { tavilySearch } from "../tools/tavily";
import { renderTemplate } from "../email/render";
import { sendEmail } from "../email/acs-client";
import { getCompany } from "../lib/company";

export class WelcomeAgent extends BaseAgent {
  readonly system = "welcome" as const;
  protected readonly systemPrompt = "Welcome email agent.";
  protected readonly tools = [];

  protected async execute(ctx: AgentContext, ticketId: string): Promise<AgentResult> {
    const company = getCompany();
    const cand = ctx.candidate;

    const team = await lookupTeam(cand.team);
    const role = await lookupRole(cand.role);
    const softwareIds = role ? await lookupSoftwareForRole(role.id) : [];
    const softwareNames: string[] = [];
    for (const id of softwareIds) {
      const sw = await lookupSoftwareCatalogEntry(id);
      if (sw) softwareNames.push(sw.name);
    }
    const docs = await lookupDocumentsFor("IN", "fulltime");
    const buddy = team?.buddy_pool?.[0];

    let accommodationSection = "";
    const isRelocating =
      !!cand.current_city && cand.current_city.toLowerCase() !== company.officeCity.toLowerCase();
    if (isRelocating) {
      const query = `serviced apartments and hotels near ${company.officeAddress} under 6000 INR per night`;
      const results = await tavilySearch(query, 3);
      if (results.length > 0) {
        const items = results
          .map((r) => `<li><strong><a href="${r.url}">${r.title}</a></strong> — ${r.content.slice(0, 120)}…</li>`)
          .join("");
        accommodationSection = `
        <mj-text font-size="16px" font-weight="600" padding-top="16px" padding-bottom="8px">Pre-arrival accommodation suggestions</mj-text>
        <mj-text>You're relocating from ${cand.current_city} → ${company.officeCity}. A few options near our office:<br/><ul>${items}</ul></mj-text>`;
      }
    }

    const html = await renderTemplate("welcome", {
      company_name: company.name,
      brand_color: company.brandColor,
      candidate_name: cand.name,
      role: cand.role,
      team: cand.team,
      joining_date: cand.joining_date,
      manager_name: cand.manager,
      office_address: company.officeAddress,
      buddy_name: buddy?.name ?? "your buddy",
      buddy_email: buddy?.email ?? "",
      entitlements: softwareNames.join(", "),
      documents: (docs?.documents ?? []).join(", "),
      accommodation_section: accommodationSection,
    });

    const send = await sendEmail({
      to: cand.email,
      subject: `Welcome to ${company.name} — your first day at ${cand.team}`,
      html,
      candidateId: cand.id,
      runId: ctx.runId,
    });

    return {
      ticketId,
      artifactSummary: `Sent to ${cand.email}`,
      ticketFields: {
        recipients: cand.email,
        subject: `Welcome to ${company.name}`,
        sent_at: new Date().toISOString(),
        message_id: send.messageId,
        relocating: String(isRelocating),
      },
    };
  }
}
