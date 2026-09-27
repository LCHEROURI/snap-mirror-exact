import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { realtimeSession, realtimeTurn, voiceSetup, voiceSpeak, voiceTurn } from "@/lib/voice.functions";
import { RealtimeVoiceProvider } from "@/lib/voice/realtime-provider";
import { TurnVoiceProvider } from "@/lib/voice/turn-provider";
import { VOICE_MESSAGES, voiceSupported, type TranscriptLine, type VoiceErrorCode, type VoiceProvider, type VoiceState } from "@/lib/voice/types";

/** Owns the active provider; only one ever runs at a time, and unmount always stops the microphone. */
export function useVoiceSession(sessionId: string, initial: TranscriptLine[], autoPlay = true) {
  const setupFn = useServerFn(voiceSetup);
  const secretFn = useServerFn(realtimeSession);
  const saveFn = useServerFn(realtimeTurn);
  const turnFn = useServerFn(voiceTurn);
  const speakFn = useServerFn(voiceSpeak);

  const [state, setState] = useState<VoiceState>("connecting");
  const [mode, setMode] = useState<"realtime" | "turn" | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>(initial);
  const [error, setError] = useState<{ code: VoiceErrorCode; message: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const provider = useRef<VoiceProvider | null>(null);

  const events = {
    onState: setState,
    onTranscript: (l: TranscriptLine) =>
      setLines((prev) => {
        const i = prev.findIndex((x) => x.id === l.id);
        if (!l.text && l.final) return prev.filter((x) => x.id !== l.id);
        if (i === -1) return [...prev, l];
        const next = [...prev];
        next[i] = l;
        return next;
      }),
    onError: (code: VoiceErrorCode, message: string) => setError({ code, message: message || VOICE_MESSAGES[code] }),
  };

  const startTurn = useCallback(async (reason?: string) => {
    provider.current?.stop();
    setMode("turn");
    if (reason) setNotice("Live voice isn't available, so you're using turn-by-turn voice: speak, then tap “Done speaking”.");
    const p = new TurnVoiceProvider({
      sendTurn: (audio) => { const fd = new FormData(); fd.append("sessionId", sessionId); fd.append("audio", audio); return turnFn({ data: fd }); },
      speak: (messageId) => speakFn({ data: { messageId } }),
      idleTimeoutSeconds: 120,
      autoPlay,
    }, events);
    provider.current = p;
    await p.start();
  }, [sessionId, autoPlay]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async () => {
    setError(null);
    setState("connecting");
    if (!voiceSupported()) { events.onError("unsupported", ""); setState("error"); return; }
    const s = await setupFn({ data: { sessionId } }).catch(() => null);
    if (!s) { events.onError("connection_lost", "Couldn't reach Reflective. Check your connection and try again."); setState("error"); return; }
    if (!s.ok) { events.onError(s.code === "expired" ? "expired" : "unavailable", s.error); setState("error"); return; }
    if (!s.modes.includes("realtime")) return startTurn("unavailable");
    setMode("realtime");
    const p = new RealtimeVoiceProvider({
      getSecret: () => secretFn({ data: { sessionId } }),
      saveTurn: (role, text, itemId) => saveFn({ data: { sessionId, role, text, itemId } }),
      onFallback: (reason) => { void startTurn(reason); },
    }, events);
    provider.current = p;
    await p.start();
  }, [sessionId, startTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => { provider.current?.stop(); provider.current = null; }, []);

  useEffect(() => {
    const offline = () => events.onError("connection_lost", "");
    window.addEventListener("offline", offline);
    window.addEventListener("pagehide", stop);
    return () => { window.removeEventListener("offline", offline); window.removeEventListener("pagehide", stop); stop(); };
  }, [stop]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    state, mode, lines, error, notice, muted,
    start,
    stop,
    useTurnMode: () => startTurn("manual"),
    endTurn: () => provider.current?.endTurn?.(),
    toggleMute: () => { const m = !muted; setMuted(m); provider.current?.setMuted(m); },
    pause: () => provider.current?.pause(),
    resume: () => provider.current?.resume(),
    clearError: () => setError(null),
  };
}
