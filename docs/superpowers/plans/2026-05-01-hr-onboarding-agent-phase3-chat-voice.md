# HR Onboarding Agent — Phase 3: Chat + Voice Agent

> **Plan execution:** inline.

**Goal:** Add a ChatGPT-style chat sidebar AND a voice mic that share the same agent backend. Both call three tools (`lookup_status`, `start_onboarding`, `amend_onboarding`) and write to the same conversation history. Replace the temporary "Onboard" button on the candidates table with these natural-language entry points.

**Architecture:**
- **Chat path:** Browser → portal `/api/chat` (SSE stream) → orchestrator `/chat` → Azure OpenAI Chat Completions with tool calling.
- **Voice path:** Browser ↔ Azure OpenAI Realtime (WebRTC, direct). Portal mints ephemeral session via `/api/voice/token` → orchestrator `/voice/session`.
- **Shared transcript:** chat + voice messages render in the same sidebar thread.
- **Server-pushed narration:** orchestrator publishes `narration.cue` on Redis pub/sub → portal SSE → browser → injected into Realtime session.

**Tech stack additions:** OpenAI Chat Completions streaming API (already pulled in by `openai` package), `@azure/openai` for typing helpers, browser WebRTC + `RTCPeerConnection`.

**Phase context:** Phase 3 of 4. Phase 4 adds master-data admin UI + polish.

---

## Task list (executed inline)

### P3.1 Tool implementations (server-side, used by both chat + voice)
- `packages/orchestrator/src/agent-tools/index.ts` — JSON-schema for the 3 tools + execution functions
- `lookup_status(name_or_id)` reuses existing `/lookup` logic
- `start_onboarding(...)` calls `runOnboarding`
- `amend_onboarding(...)` calls `amendOnboarding`

### P3.2 Orchestrator `/chat` SSE endpoint
- `POST /chat` body: `{ messages: ChatMessage[] }`
- Streams Server-Sent Events: `{type:"delta", text}` for tokens, `{type:"tool_call", name, args}` and `{type:"tool_result", id, result}` for tool roundtrips, `{type:"done"}` at the end.
- Internal loop: until response done, run Chat Completions with tools; on tool_call, execute, append result, loop.

### P3.3 Orchestrator `/voice/session` endpoint
- Returns Realtime session config (deployment name, endpoint, ephemeral key) for the browser to use directly.
- Currently returns a "client_secret" via Azure Realtime sessions API. Mock fallback returns a placeholder if `AZURE_OPENAI_API_KEY` unset.

### P3.4 Portal `/api/chat` and `/api/voice/token` proxies
- `/api/chat` proxies the SSE stream from orchestrator to browser unchanged.
- `/api/voice/token` proxies orchestrator's `/voice/session` response.

### P3.5 Chat sidebar — replace placeholder with real chat UI
- Conversation thread (HR turns right-aligned, agent left-aligned)
- Text input + send button (Enter to send)
- Streaming agent message (token-by-token)
- Tool-call cards rendered inline (collapsed by default, expand to see name + args + result)
- Persists transcript in `localStorage` per-tab so refresh keeps the convo

### P3.6 Voice integration (Realtime API in browser)
- Mic button: starts a `RTCPeerConnection`, sends offer to Azure Realtime, attaches output audio
- Voice transcripts (input + output) added to the same chat thread
- Tool calls fire the same handler as chat
- Server can inject narration cues via SSE → `conversation.item.create` + `response.create`

### P3.7 Remove "Onboard" button on candidates table
- The button was a Phase 2 stopgap. Phase 3 entry point is chat/voice. Keep it for accessibility / fallback but rename to "Onboard manually" and add small tooltip.

### P3.8 e2e: chat triggers cascade
- Type "Onboard Karan Shah, Senior Frontend Engineer, AI Platform team, joining May 12" → assert tiles flip to done.

### P3.9 README + tag

---

## Wow moments wired in Phase 3
- W5: HR types/says "actually, change to AI Infrastructure" → orchestrator runs amend
- W9: Voice closing "thank you" / "my pleasure" — handled in system prompt

## What stays for Phase 4
- Master data admin matrix UI
- Big-number reveal animation on /admin
- Rehearsal mode (`npm run rehearse`)
- Final UI polish pass via frontend-design skill
