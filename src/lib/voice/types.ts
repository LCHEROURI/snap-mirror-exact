// Shared contract for voice providers so the screen doesn't care which path is live.
export type VoiceState =
  | "connecting"
  | "ready"
  | "listening"
  | "thinking"
  | "speaking"
  | "paused"
  | "reconnecting"
  | "ended"
  | "error";

export type VoiceErrorCode =
  | "mic_blocked"
  | "no_mic"
  | "unsupported"
  | "unavailable"
  | "connection_lost"
  | "transcription"
  | "playback"
  | "expired"
  | "other";

export type TranscriptLine = {
  id: string;
  role: "user" | "assistant";
  text: string;
  final: boolean;
};

export type VoiceEvents = {
  onState: (s: VoiceState) => void;
  onTranscript: (line: TranscriptLine) => void;
  onError: (code: VoiceErrorCode, message: string) => void;
};

export interface VoiceProvider {
  readonly kind: "realtime" | "turn";
  start(): Promise<void>;
  setMuted(muted: boolean): void;
  pause(): void;
  resume(): void;
  /** Must stop every microphone track and close connections. Safe to call twice. */
  stop(): void;
  /** Turn-based only: finish the current recording and send it. */
  endTurn?(): void;
}

export const VOICE_MESSAGES: Record<VoiceErrorCode, string> = {
  mic_blocked:
    "Microphone access is blocked. Enable microphone permission for this site in your browser settings, then try again.",
  no_mic: "No microphone was found. Connect one, then try again.",
  unsupported:
    "This browser doesn't support voice recording. Try a recent Chrome, Safari or Edge — or write instead.",
  unavailable: "Voice service is unavailable right now.",
  connection_lost: "Connection lost. Your transcript so far is saved.",
  transcription: "Transcription failed. Please try that turn again.",
  playback: "Audio playback failed. The reply is shown as text.",
  expired: "This voice session has expired. Finish the reflection to save it.",
  other: "Something went wrong with voice. Your transcript so far is saved.",
};

/** Maps getUserMedia failures to a clear next step. */
export function micError(e: unknown): VoiceErrorCode {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "mic_blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no_mic";
  if (name === "NotSupportedError" || name === "TypeError") return "unsupported";
  return "other";
}

export function voiceSupported() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== "undefined" &&
    "AudioContext" in window
  );
}
