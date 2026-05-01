import { EmailClient } from "@azure/communication-email";
import { publishAgentEvent } from "../lib/events";

export interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  text?: string;
  candidateId?: string;
  runId?: string;
}

export interface SendEmailResult {
  messageId: string;
  delivered: boolean;
}

let client: EmailClient | null = null;

function getClient(): EmailClient {
  if (client) return client;
  const conn = process.env.AZURE_COMM_CONNECTION_STRING;
  if (!conn) throw new Error("AZURE_COMM_CONNECTION_STRING not set");
  client = new EmailClient(conn);
  return client;
}

export async function sendEmail(opts: SendEmailOpts): Promise<SendEmailResult> {
  const sender = process.env.AZURE_COMM_SENDER_ADDRESS;
  const conn = process.env.AZURE_COMM_CONNECTION_STRING;

  if (!sender || !conn) {
    console.log(`[email] mock send → ${opts.to} subject="${opts.subject}"`);
    const mockId = `mock-${Date.now()}`;
    if (opts.candidateId) {
      await publishAgentEvent({
        type: "email.sent",
        candidate_id: opts.candidateId,
        payload: { to: opts.to, subject: opts.subject, message_id: mockId },
        timestamp: new Date().toISOString(),
        run_id: opts.runId,
      });
    }
    return { messageId: mockId, delivered: true };
  }

  const c = getClient();
  const poller = await c.beginSend({
    senderAddress: sender,
    content: {
      subject: opts.subject,
      html: opts.html,
      plainText: opts.text,
    },
    recipients: { to: [{ address: opts.to }] },
  });
  const result = await poller.pollUntilDone();
  const messageId = result.id ?? `acs-${Date.now()}`;

  if (opts.candidateId) {
    await publishAgentEvent({
      type: "email.sent",
      candidate_id: opts.candidateId,
      payload: { to: opts.to, subject: opts.subject, message_id: messageId },
      timestamp: new Date().toISOString(),
      run_id: opts.runId,
    });
  }

  return { messageId, delivered: result.status === "Succeeded" };
}
