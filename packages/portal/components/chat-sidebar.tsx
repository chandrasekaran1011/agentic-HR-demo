"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceAgent } from "./voice-agent";

interface ChatSidebarProps {
  userName: string;
  companyName: string;
}

interface ChatTurn {
  id: string;
  role: "user" | "assistant" | "tool";
  text?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: { ok?: boolean; message?: string };
  source?: "chat" | "voice";
  pending?: boolean;
}

const STORAGE_KEY = "hr-agent-chat-history";

export function ChatSidebar({ userName, companyName }: ChatSidebarProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const voice = useVoiceAgent({
    onTurn: (t) => setTurns((prev) => [...prev, t]),
  });

  // Restore history
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setTurns(JSON.parse(saved));
    } catch {}
  }, []);

  // Persist
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(turns));
    } catch {}
  }, [turns]);

  // Autoscroll
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.href = "/login";
  }

  function clearChat() {
    setTurns([]);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userTurn: ChatTurn = { id: `u-${Date.now()}`, role: "user", text, source: "chat" };
    const newHistory = [...turns, userTurn];
    setTurns(newHistory);
    setStreaming(true);

    // Build OpenAI-style messages from history (skip tool cards we display)
    const messages = newHistory
      .filter((t) => (t.role === "user" || t.role === "assistant") && t.text)
      .map((t) => ({ role: t.role, content: t.text! }));

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok || !res.body) {
      setTurns((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", text: "[Error contacting agent]" }]);
      setStreaming(false);
      return;
    }

    const assistantId = `a-${Date.now()}`;
    setTurns((prev) => [...prev, { id: assistantId, role: "assistant", text: "", source: "chat", pending: true }]);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const event = JSON.parse(payload);
          if (event.type === "delta" && typeof event.text === "string") {
            assistantText += event.text;
            setTurns((prev) =>
              prev.map((t) => (t.id === assistantId ? { ...t, text: assistantText } : t))
            );
          } else if (event.type === "tool_call") {
            setTurns((prev) => [
              ...prev,
              {
                id: `tc-${event.id}`,
                role: "tool",
                toolName: event.name,
                toolArgs: event.args,
              },
            ]);
          } else if (event.type === "tool_result") {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === `tc-${event.id}` ? { ...t, toolResult: event.result } : t
              )
            );
          } else if (event.type === "done") {
            setTurns((prev) =>
              prev.map((t) => (t.id === assistantId ? { ...t, pending: false } : t))
            );
          }
        } catch {}
      }
    }
    setStreaming(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <aside className="w-[30%] min-w-[400px] max-w-[640px] bg-slate-900 border-r border-slate-800 flex flex-col h-screen">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{companyName}</h1>
          <p className="text-xs text-slate-400">HR Onboarding Agent</p>
        </div>
        <button
          onClick={clearChat}
          className="text-xs text-slate-500 hover:text-slate-200"
          title="Clear conversation"
        >
          clear
        </button>
      </div>

      <div ref={transcriptRef} className="flex-1 p-4 overflow-y-auto space-y-3">
        {turns.length === 0 && (
          <p className="text-sm text-slate-500 italic px-2">
            Start by asking about a candidate, or say "Onboard a new joiner…"
          </p>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {t.role === "tool" ? (
                <ToolCard
                  name={t.toolName!}
                  args={t.toolArgs}
                  result={t.toolResult}
                />
              ) : (
                <div
                  className={`max-w-[88%] rounded-lg px-3 py-2 text-sm ${
                    t.role === "user"
                      ? "bg-blue-600/30 text-blue-50 border border-blue-600/40"
                      : "bg-slate-800 text-slate-100 border border-slate-700"
                  }`}
                >
                  {t.source === "voice" && (
                    <div className="text-xs text-slate-400 mb-1">🎙 voice</div>
                  )}
                  {t.text || (t.pending ? <span className="opacity-60">…</span> : "")}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask the agent…"
            className="flex-1 min-h-[44px] max-h-32 rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm resize-none focus:outline-none focus:border-slate-500"
            rows={1}
            disabled={streaming}
          />
          <Button onClick={sendMessage} disabled={streaming || !input.trim()} size="icon" title="Send">
            <Send className="size-4" />
          </Button>
          <Button
            onClick={voice.connected ? voice.stop : voice.start}
            size="icon"
            variant={voice.connected ? "destructive" : "secondary"}
            title={voice.connected ? "End voice" : "Start voice"}
          >
            {voice.connected ? <Square className="size-4" /> : <Mic className="size-4" />}
          </Button>
        </div>
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>
            {voice.state === "listening"
              ? "🎤 listening…"
              : voice.state === "speaking"
              ? "🔊 speaking…"
              : voice.state === "connecting"
              ? "connecting…"
              : "idle"}
          </span>
          <div className="flex gap-3">
            <span>{userName}</span>
            <button onClick={logout} className="hover:text-slate-200 underline-offset-2 hover:underline">
              logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ToolCard({
  name,
  args,
  result,
}: {
  name: string;
  args?: string;
  result?: { ok?: boolean; message?: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="max-w-[88%] w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-slate-300 hover:text-slate-100"
      >
        <span>
          <span className="text-violet-400 font-mono mr-2">tool</span>
          <span className="font-medium">{name}</span>
          {result && (
            <span className={`ml-2 ${result.ok ? "text-emerald-400" : "text-rose-400"}`}>
              {result.ok ? "✓" : "✗"}
            </span>
          )}
        </span>
        <span className="text-slate-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1 text-slate-400 font-mono">
          {args && <div className="break-all">args: {args}</div>}
          {result?.message && <div className="text-slate-300 whitespace-pre-wrap">{result.message}</div>}
        </div>
      )}
    </div>
  );
}
