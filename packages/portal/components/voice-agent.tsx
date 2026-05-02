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

  // Auto-end after this much silence while listening for the user. Timer is
  // paused while Sara is speaking and reset whenever the user starts talking.
  const IDLE_TIMEOUT_MS = 10_000;
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearIdleTimer() {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }

  function startIdleTimer() {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      onTurnRef.current({
        id: `vidle-${Date.now()}`,
        role: "assistant",
        text: `Voice ended after ${IDLE_TIMEOUT_MS / 1000}s of silence. Click the mic to start again.`,
        source: "voice",
      });
      stop();
    }, IDLE_TIMEOUT_MS);
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
        // Ask Sara to greet first.
        try {
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
          console.warn("[voice] failed to send greeting", e);
        }
        // Idle timer starts on response.done (after Sara's greeting).
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

  async function handleRealtimeEvent(raw: string) {
    let event: { type: string; [k: string]: unknown };
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    const type = event.type;

    // Speech state + silence-timeout management
    if (type === "input_audio_buffer.speech_started") {
      setState("listening");
      // User started talking — cancel the silence timer
      clearIdleTimer();
    }
    if (type === "response.audio.delta") {
      // Sara is speaking — pause the silence timer
      setState("speaking");
      clearIdleTimer();
    }
    if (type === "response.done") {
      // Sara finished — start the 10s silence countdown
      setState("listening");
      startIdleTimer();
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

  return { state, connected, start, stop };
}
