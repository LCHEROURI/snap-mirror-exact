// Central AI configuration. Override via server env vars without code changes.
export function aiConfig() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured");
  return {
    apiKey,
    baseURL: "https://ai.gateway.lovable.dev/v1",
    chatModel: process.env["JOURNAL_CHAT_MODEL"] || "openai/gpt-6-astra",
    askModel: process.env["ASK_JOURNAL_MODEL"] || "openai/gpt-6-astra",
    analysisModel: process.env["JOURNAL_ANALYSIS_MODEL"] || "openai/gpt-6-astra",
    weeklyModel: process.env["WEEKLY_REPORT_MODEL"] || "openai/gpt-6-astra",
  };
}

/** Voice configuration. Realtime needs the user's own OPENAI_API_KEY; the turn-based path uses the gateway. */
export function voiceConfig() {
  const num = (k: string, d: number) => {
    const v = Number(process.env[k]);
    return Number.isFinite(v) && v > 0 ? v : d;
  };
  return {
    openaiKey: process.env["OPENAI_API_KEY"] || null,
    realtimeModel: process.env["REALTIME_MODEL"] || "gpt-realtime",
    realtimeVoice: process.env["REALTIME_VOICE"] || "marin",
    realtimeTranscriptionModel:
      process.env["REALTIME_TRANSCRIPTION_MODEL"] || "gpt-4o-mini-transcribe",
    transcriptionModel: process.env["TRANSCRIPTION_MODEL"] || "google/gemini-3.5-transcribe",
    ttsModel: process.env["TTS_MODEL"] || "google/gemini-3.1-flash-tts-preview",
    ttsVoice: process.env["TTS_VOICE"] || "Kore",
    maxSessionMinutes: num("VOICE_MAX_SESSION_MINUTES", 30),
    idleTimeoutSeconds: num("VOICE_IDLE_TIMEOUT_SECONDS", 120),
    maxAudioBytes: 12 * 1024 * 1024,
  };
}

export const CONTEXT = {
  recentMessages: 12, // messages sent verbatim
  summarizeEvery: 12, // older messages folded into the rolling summary in batches
  maxMessageChars: 4000,
  maxTranscriptChars: 60000,
  maxUserMessagesPerMinute: 12,
};
