import { AzureOpenAI } from "openai";
import type { ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

// CHAT (text) configuration is independent from REALTIME (voice) — Azure AI
// Foundry deployments often live on different resources for these two model
// families. We read CHAT-specific env first; fall back to the legacy generic
// AZURE_OPENAI_* env so older configs keep working.

interface ChatConfig {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  deployment: string;
}

function readChatConfig(): ChatConfig | null {
  const endpoint = process.env.AZURE_OPENAI_CHAT_ENDPOINT ?? process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_CHAT_API_KEY ?? process.env.AZURE_OPENAI_API_KEY;
  const apiVersion =
    process.env.AZURE_OPENAI_CHAT_API_VERSION ?? process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
  const deployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT;
  if (!endpoint || !apiKey || !deployment) return null;
  return { endpoint, apiKey, apiVersion, deployment };
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

export interface ChatCompleteOpts {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  jsonMode?: boolean;
  maxTokens?: number;
}

export async function chatComplete(opts: ChatCompleteOpts): Promise<ChatCompletion> {
  const cfg = readChatConfig();
  if (!cfg) return mockChatComplete(opts);
  const c = getClient(cfg);
  return c.chat.completions.create({
    model: cfg.deployment,
    messages: opts.messages,
    tools: opts.tools,
    tool_choice: opts.toolChoice,
    response_format: opts.jsonMode ? { type: "json_object" } : undefined,
    max_tokens: opts.maxTokens ?? 1024,
  }) as unknown as ChatCompletion;
}

// Deterministic mock — used when chat keys aren't configured.
function mockChatComplete(opts: ChatCompleteOpts): ChatCompletion {
  const last = opts.messages[opts.messages.length - 1];
  const lastContent =
    typeof last?.content === "string" ? last.content : JSON.stringify(last?.content ?? "");

  let finalText = "ok";
  const m = /MOCK_FINAL=([^\n]+)/.exec(
    JSON.stringify(opts.messages.map((msg) => msg.content))
  );
  if (m && m[1]) finalText = m[1].trim();

  if (opts.jsonMode) {
    finalText = "{}";
  }

  return {
    id: "mock-cmpl-" + Date.now(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "mock",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        logprobs: null,
        message: {
          role: "assistant",
          content: finalText,
          refusal: null,
          tool_calls: undefined,
        } as ChatCompletion["choices"][0]["message"],
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    _mock: true,
    _lastUserContent: lastContent,
  } as unknown as ChatCompletion;
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
  const endpoint =
    process.env.AZURE_OPENAI_REALTIME_ENDPOINT ?? process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey =
    process.env.AZURE_OPENAI_REALTIME_API_KEY ?? process.env.AZURE_OPENAI_API_KEY;
  const apiVersion =
    process.env.AZURE_OPENAI_REALTIME_API_VERSION ??
    process.env.AZURE_OPENAI_API_VERSION ??
    "2024-10-01-preview";
  const deployment = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT;
  if (!endpoint || !apiKey || !deployment) return null;
  return { endpoint, apiKey, apiVersion, deployment };
}
