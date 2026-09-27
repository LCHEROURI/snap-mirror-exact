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
  };
}

export const CONTEXT = {
  recentMessages: 12, // messages sent verbatim
  summarizeEvery: 12, // older messages folded into the rolling summary in batches
  maxMessageChars: 4000,
  maxTranscriptChars: 60000,
  maxUserMessagesPerMinute: 12,
};
