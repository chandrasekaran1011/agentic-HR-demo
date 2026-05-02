"use client";

import { useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "thinking";

export interface VoiceTurn {
  id: string;
  role: "user" | "assistant" | "tool";
  text?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: { ok?: boolean; message?: string };
  source?: "chat" | "voice";
  pending?: boolean;
}

interface UseVoiceAgentOptions {
  onTurn: (turn: VoiceTurn) => void;
}

export function useVoiceAgent(opts: UseVoiceAgentOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [connected, setConnected] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onTurnRef = useRef(opts.onTurn);
  onTurnRef.current = opts.onTurn;

  // Auto-end after this much MUTUAL silence (neither user nor Sara talking).
  // Timer is paused while Sara is speaking AND while the user is speaking;
  // it only counts down during dead air after Sara finished a turn.
  const IDLE_TIMEOUT_MS = 10_000;
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flag set when the next response.done should be the last one — used both
  // for "user said thank you/bye" and "idle timeout, asked Sara to sign off".
  const endingAfterResponseRef = useRef(false);

  function clearIdleTimer() {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }

  function startIdleTimer() {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      // Don't end abruptly — ask Sara to say a brief sign-off, then end on
      // her response.done. If the data channel isn't there, just stop.
      if (!dcRef.current || dcRef.current.readyState !== "open") {
        stop();
        return;
      }
      endingAfterResponseRef.current = true;
      try {
        dcRef.current.send(
          JSON.stringify({
            type: "response.create",
            response: {
              modalities: ["audio", "text"],
              instructions:
                "The user has been silent for 10 seconds. Say exactly: 'Looks like that's all — call me back whenever you need anything else.' and nothing more.",
            },
          })
        );
      } catch {
        stop();
      }
    }, IDLE_TIMEOUT_MS);
  }

  // Match common goodbye / end phrases. Conservative — must be a clear sign-off.
  function isGoodbyeUtterance(text: string): boolean {
    const t = text.toLowerCase().trim();
    if (!t) return false;
    return (
      /(^|\b)(thank\s*you|thanks|thank\s*u|thx|tysm)(\b|$)/.test(t) ||
      /(^|\b)(good\s*bye|bye|byebye|good\s*night|cheers)(\b|$)/.test(t) ||
      /(^|\b)(end\s*(the\s+)?(call|session|chat))(\b|$)/.test(t) ||
      /(^|\b)(quit|exit|stop|hang\s*up|that'?s\s*(all|it)|we'?re\s*done|i'?m\s*done|that'?ll\s*be\s*all)(\b|$)/.test(t)
    );
  }

  useEffect(() => {
    if (!audioRef.current && typeof window !== "undefined") {
      const a = new Audio();
      a.autoplay = true;
      audioRef.current = a;
    }
    return () => {
      clearIdleTimer();
    };
  }, []);

  async function start() {
    if (connected || state === "connecting") return;
    setState("connecting");

    try {
      const tokenRes = await fetch("/api/voice/token");
      const tokenData = await tokenRes.json();
      if (tokenData.mock) {
        onTurnRef.current({
          id: `vsys-${Date.now()}`,
          role: "assistant",
          text: "Voice is in mock mode — set AZURE_OPENAI_API_KEY and AZURE_OPENAI_REALTIME_DEPLOYMENT to enable.",
          source: "voice",
        });
        setState("idle");
        return;
      }
      if (!tokenData.session?.client_secret?.value) {
        throw new Error("session mint failed: " + JSON.stringify(tokenData));
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (e) => {
        if (audioRef.current && e.streams[0]) {
          audioRef.current.srcObject = e.streams[0];
        }
      };

      // Mic input
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.getTracks().forEach((track) => pc.addTrack(track, micStream));

      // Data channel for events + tool calls
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (msgEvent) => handleRealtimeEvent(msgEvent.data);
      dc.onopen = () => {
        setConnected(true);
        setState("listening");
        try {
          // Voice is set ONCE in the server-side session mint
          // (orchestrator's /voice/session). We do NOT issue session.update
          // here — Azure Realtime preview ignores voice changes after the
          // first audio response is queued, and re-asserting it can cause
          // visible voice drift between turns. Same reason we no longer
          // specify response.voice on response.create — let the session
          // default carry through.
          //
          // Just enable transcription + ask Sara to greet.
          dc.send(
            JSON.stringify({
              type: "session.update",
              session: {
                input_audio_transcription: { model: "whisper-1" },
              },
            })
          );
          dc.send(
            JSON.stringify({
              type: "response.create",
              response: {
                modalities: ["audio", "text"],
                instructions:
                  "Greet the user with exactly: 'Hi, I'm Sara, your onboarding assistant. How can I help you today?' Then wait for them to respond.",
              },
            })
          );
        } catch (e) {
          console.warn("[voice] failed to initialize session", e);
        }
        // Idle timer starts on output_audio_buffer.stopped after greeting.
      };
      dc.onclose = () => {
        clearIdleTimer();
        setConnected(false);
        setState("idle");
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // SDP exchange happens on Microsoft's region-specific WebRTC endpoint,
      // not on the Azure resource endpoint. The orchestrator returns the URL
      // (auto-derived from region or via AZURE_OPENAI_REALTIME_WEBRTC_URL).
      if (!tokenData.webrtcUrl) {
        throw new Error("orchestrator did not return webrtcUrl");
      }
      const sdpRes = await fetch(
        `${tokenData.webrtcUrl}?model=${encodeURIComponent(tokenData.deployment)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.session.client_secret.value}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        }
      );
      if (!sdpRes.ok) {
        const detail = await sdpRes.text().catch(() => "");
        throw new Error(`SDP exchange failed: ${sdpRes.status} ${detail.slice(0, 200)}`);
      }
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (err) {
      console.error("[voice] start failed", err);
      onTurnRef.current({
        id: `verr-${Date.now()}`,
        role: "assistant",
        text: `Voice connect failed: ${(err as Error).message}`,
        source: "voice",
      });
      setState("idle");
    }
  }

  function stop() {
    clearIdleTimer();
    dcRef.current?.close();
    pcRef.current?.close();
    pcRef.current = null;
    dcRef.current = null;
    setConnected(false);
    setState("idle");
  }

  /**
   * Inject a narration cue into the active Realtime session — Sara will
   * speak the text aloud verbatim. No-op if voice isn't connected.
   * Called from the chat-sidebar SSE bridge when the orchestrator publishes
   * narration.cue events during a cascade.
   */
  function playNarration(text: string): void {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open" || !text.trim()) return;
    try {
      // One-off response that inherits the session voice. We deliberately
      // do NOT send response.cancel beforehand — cancelling an in-flight
      // response can cause the next response to drift to a different
      // voice / cadence on Azure's preview Realtime API. Cues are short,
      // and queuing them is acceptable.
      dc.send(
        JSON.stringify({
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            instructions: `Say exactly the following sentence and nothing else: "${text.replace(/"/g, "'")}"`,
          },
        })
      );
    } catch (e) {
      console.warn("[voice] failed to inject narration cue", e);
    }
  }

  async function handleRealtimeEvent(raw: string) {
    let event: { type: string; [k: string]: unknown };
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    const type = event.type;

    // ── Speech state + silence-timeout management ──────────────────
    //
    // CRITICAL: response.done fires when the model is done GENERATING the
    // response, but Sara's audio is still PLAYING in the browser for
    // several more seconds. If we start the 10s timer on response.done,
    // the user gets dropped while Sara is mid-sentence.
    //
    // Real "Sara is done speaking" signal is output_audio_buffer.stopped.
    // We listen on both buffer events to bracket Sara's speech.
    if (type === "input_audio_buffer.speech_started") {
      setState("listening");
      // User started talking — cancel the silence timer (mutual silence broken)
      clearIdleTimer();
    }
    if (type === "input_audio_buffer.speech_stopped") {
      // User stopped — Sara will respond next; do NOT start the idle timer
      // here; we start it on output_audio_buffer.stopped when she's done.
    }
    if (type === "response.audio.delta" || type === "output_audio_buffer.started") {
      // Sara's audio is being delivered to the browser — pause the silence timer
      setState("speaking");
      clearIdleTimer();
    }
    if (type === "output_audio_buffer.stopped") {
      // Sara's audio buffer has fully drained in the browser — only NOW
      // is the floor genuinely open for the user to talk.
      if (endingAfterResponseRef.current) {
        endingAfterResponseRef.current = false;
        setState("listening");
        setTimeout(() => stop(), 600);
        return;
      }
      setState("listening");
      startIdleTimer();
    }
    if (type === "response.done") {
      // Don't manage the timer here — wait for output_audio_buffer.stopped
      // (which fires AFTER audio finishes playing). response.done only
      // means the model finished generating, not that audio is done.
      // Kept the branch for endingAfterResponseRef as a safety net in
      // case output_audio_buffer.stopped doesn't fire (e.g. text-only).
      if (endingAfterResponseRef.current && state !== "speaking") {
        endingAfterResponseRef.current = false;
        setTimeout(() => stop(), 1500);
      }
    }

    // User transcript
    if (type === "conversation.item.input_audio_transcription.completed") {
      const text = (event as { transcript?: string }).transcript;
      if (text) {
        onTurnRef.current({
          id: `vu-${Date.now()}-${Math.random()}`,
          role: "user",
          text,
          source: "voice",
        });
        // Detect verbal end commands: "thank you", "bye", "quit", "stop", etc.
        // Sara will still respond once (her response.done triggers stop()).
        if (isGoodbyeUtterance(text)) {
          endingAfterResponseRef.current = true;
        }
      }
    }

    // Assistant transcript (final)
    if (type === "response.audio_transcript.done") {
      const text = (event as { transcript?: string }).transcript;
      if (text) {
        onTurnRef.current({
          id: `va-${Date.now()}-${Math.random()}`,
          role: "assistant",
          text,
          source: "voice",
        });
      }
    }

    // Tool call from the model
    if (type === "response.function_call_arguments.done") {
      const e = event as { name?: string; call_id?: string; arguments?: string };
      const name = e.name;
      const callId = e.call_id;
      const args = e.arguments ?? "{}";
      if (!name || !callId) return;

      onTurnRef.current({
        id: `vtc-${callId}`,
        role: "tool",
        toolName: name,
        toolArgs: args,
      });

      const res = await fetch("/api/voice/tool", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, arguments: args }),
      });
      const result = await res.json();

      onTurnRef.current({
        id: `vtc-${callId}-result`,
        role: "tool",
        toolName: name,
        toolArgs: args,
        toolResult: result,
      });

      // Send the result back into the realtime session
      dcRef.current?.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(result),
          },
        })
      );
      dcRef.current?.send(JSON.stringify({ type: "response.create" }));
    }
  }

  return { state, connected, start, stop, playNarration };
}
