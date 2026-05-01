import { AzureOpenAI } from "openai";
import type { ChatCompletion, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

let client: AzureOpenAI | null = null;

function hasAzureConfig(): boolean {
  return !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT);
}

function getClient(): AzureOpenAI {
  if (client) return client;
  client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21",
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
  if (!hasAzureConfig()) {
    return mockChatComplete(opts);
  }
  const deployment = process.env.AZURE_OPENAI_GPT4O_DEPLOYMENT;
  if (!deployment) throw new Error("AZURE_OPENAI_GPT4O_DEPLOYMENT not set");
  const c = getClient();
  return c.chat.completions.create({
    model: deployment,
    messages: opts.messages,
    tools: opts.tools,
    tool_choice: opts.toolChoice,
    response_format: opts.jsonMode ? { type: "json_object" } : undefined,
    max_tokens: opts.maxTokens ?? 1024,
  }) as unknown as ChatCompletion;
}

// Deterministic mock — used when Azure OpenAI keys aren't configured.
// Returns "ok" final-message responses unless the system prompt instructs
// otherwise via the `MOCK_FINAL` token.
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
    // Help downstream code see we're in mock mode if needed.
    _mock: true,
    _lastUserContent: lastContent,
  } as unknown as ChatCompletion;
}

export function isMockMode(): boolean {
  return !hasAzureConfig();
}
