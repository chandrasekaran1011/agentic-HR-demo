import { AzureOpenAI } from "openai";

// CHAT (text) configuration is independent from REALTIME (voice) — Azure AI
// Foundry deployments often live on different resources. Newer models
// (gpt-5 family) require the Responses API, not Chat Completions.

interface ChatConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  deployment: string;
}

// Normalize a possibly-pasted endpoint. Azure portal sometimes shows the
// endpoint with the full request path; the SDK wants just the resource base.
//   https://foo.cognitiveservices.azure.com/openai/responses?api-version=…
// ⇒ https://foo.cognitiveservices.azure.com
function normalizeEndpoint(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.trim().replace(/\/openai\/.*$/i, "").replace(/\/+$/, "");
}

function readChatConfig(): ChatConfig | null {
  const endpoint = normalizeEndpoint(
    process.env.AZURE_OPENAI_CHAT_ENDPOINT ?? process.env.AZURE_OPENAI_ENDPOINT
  );
  const apiKey = (process.env.AZURE_OPENAI_CHAT_API_KEY ?? process.env.AZURE_OPENAI_API_KEY)?.trim();
  const apiVersion =
    process.env.AZURE_OPENAI_CHAT_API_VERSION ?? process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT?.trim();
  if (!endpoint || !apiKey || !deployment) return null;
  return { endpoint, apiKey, apiVersion: apiVersion.trim(), deployment };
}

let client: AzureOpenAI | null = null;

function getClient(cfg: ChatConfig): AzureOpenAI {
  if (client) return client;
  client = new AzureOpenAI({
    apiKey: cfg.apiKey,
    endpoint: cfg.endpoint,
    apiVersion: cfg.apiVersion,
  });
  return client;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentInputMessage {
  type?: undefined;
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AgentFunctionCall {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

export interface AgentFunctionCallOutput {
  type: "function_call_output";
  call_id: string;
  output: string;
}

export type AgentInputItem = AgentInputMessage | AgentFunctionCall | AgentFunctionCallOutput;

export interface AgentTurnResult {
  text: string;
  toolCalls: AgentFunctionCall[];
}

/**
 * Run one turn of the agent via Azure OpenAI Responses API.
 * Returns assistant text + any function calls the model wants to make.
 * Caller handles function execution and feeds results back as the next turn.
 */
export async function runAgentTurn(
  input: AgentInputItem[],
  tools: AgentTool[]
): Promise<AgentTurnResult> {
  const cfg = readChatConfig();
  if (!cfg) return mockAgentTurn(input);

  const c = getClient(cfg);
  const responseTools = tools.map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  // Bridge SDK version skew: cast to a structural type for responses.create.
  const responsesApi = (c as unknown as {
    responses: { create: (args: unknown) => Promise<unknown> };
  }).responses;

  const res = await responsesApi.create({
    model: cfg.deployment,
    input,
    tools: responseTools.length > 0 ? responseTools : undefined,
  });

  const r = res as {
    output?: Array<{
      type: string;
      content?: Array<{ type: string; text?: string }>;
      call_id?: string;
      name?: string;
      arguments?: string;
    }>;
    output_text?: string;
  };

  // Prefer the rolled-up output_text; fall back to walking output[] items.
  let text = "";
  const toolCalls: AgentFunctionCall[] = [];

  if (typeof r.output_text === "string" && r.output_text.length > 0) {
    text = r.output_text;
  } else {
    for (const item of r.output ?? []) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === "output_text" && typeof block.text === "string") {
            text += block.text;
          }
        }
      }
    }
  }

  for (const item of r.output ?? []) {
    if (item.type === "function_call" && item.call_id && item.name) {
      toolCalls.push({
        type: "function_call",
        call_id: item.call_id,
        name: item.name,
        arguments: item.arguments ?? "{}",
      });
    }
  }

  return { text, toolCalls };
}

// Deterministic mock — used when chat keys aren't configured.
function mockAgentTurn(input: AgentInputItem[]): AgentTurnResult {
  const lastUser = [...input]
    .reverse()
    .find((i): i is AgentInputMessage => !i.type && (i as AgentInputMessage).role === "user");
  const userText = lastUser?.content ?? "";
  return {
    text: userText ? `[mock] echoing: ${userText}` : "ok",
    toolCalls: [],
  };
}

export function isMockMode(): boolean {
  return readChatConfig() === null;
}

// Realtime config (separate resource — different endpoint/key/version).
export interface RealtimeConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  deployment: string;
}

export function readRealtimeConfig(): RealtimeConfig | null {
  const endpoint = normalizeEndpoint(
    process.env.AZURE_OPENAI_REALTIME_ENDPOINT ?? process.env.AZURE_OPENAI_ENDPOINT
  );
  const apiKey = (
    process.env.AZURE_OPENAI_REALTIME_API_KEY ?? process.env.AZURE_OPENAI_API_KEY
  )?.trim();
  const apiVersion = (
    process.env.AZURE_OPENAI_REALTIME_API_VERSION ??
    process.env.AZURE_OPENAI_API_VERSION ??
    "2025-04-01-preview"
  ).trim();
  const deployment = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT?.trim();
  if (!endpoint || !apiKey || !deployment) return null;
  return { endpoint, apiKey, apiVersion, deployment };
}
