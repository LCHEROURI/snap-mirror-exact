// Voice services. Audio is never stored or logged: it is forwarded to transcription and discarded.
// Both voice paths save into journal_messages and reuse the text companion's prompt, memory and safety.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { aiConfig, voiceConfig } from "./config.server";
import { companionSystemPrompt } from "./prompts.server";
import { retrieveMemories } from "./memory.server";
import { SAFETY_RESPONSE, needsSafetyResponse } from "./safety.server";
import { JournalError } from "./journal-ai.server";

type Db = SupabaseClient<Database>;

export type VoiceMode = "realtime" | "turn";

/** Session must be the caller's (RLS), a voice session, active, and within the time limit. */
export async function ownedVoiceSession(db: Db, userId: string, sessionId: string) {
  const [{ data: s }, { data: p }] = await Promise.all([
    db.from("journal_sessions").select("id, status, session_type, started_at, rolling_summary").eq("id", sessionId).maybeSingle(),
    db.from("profiles").select("voice_enabled, display_name, reflection_style").eq("id", userId).maybeSingle(),
  ]);
  if (!s) throw new JournalError("not_found", "This reflection wasn't found.");
  if (s.session_type !== "voice") throw new JournalError("invalid", "This isn't a voice reflection.");
  if (s.status === "completed") throw new JournalError("completed", "This reflection is already finished.");
  if (p && p.voice_enabled === false) throw new JournalError("disabled", "Voice is turned off in your settings.");
  const cfg = voiceConfig();
  if (Date.now() - +new Date(s.started_at) > cfg.maxSessionMinutes * 60_000)
    throw new JournalError("expired", `Voice sessions are limited to ${cfg.maxSessionMinutes} minutes. Finish this reflection to save it.`);
  return { session: s, profile: p };
}

export function availableModes(): VoiceMode[] {
  return voiceConfig().openaiKey ? ["realtime", "turn"] : ["turn"];
}

// ---------- Turn-based: transcription ----------
export async function transcribe(audio: File) {
  const cfg = voiceConfig();
  const ai = aiConfig();
  if (!audio.size || audio.size > cfg.maxAudioBytes) throw new JournalError("invalid", "That recording was empty or too long. Please try again.");
  if (audio.size < 4096) throw new JournalError("empty", "I didn't catch anything. Please try again a little closer to the microphone.");
  const form = new FormData();
  form.append("model", cfg.transcriptionModel);
  form.append("file", new File([audio], "turn.wav", { type: "audio/wav" }));
  form.append("response_format", "json");
  form.append("stream", "true");
  const res = await fetch(`${ai.baseURL}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${ai.apiKey}` }, body: form });
  if (!res.ok || !res.body) {
    console.error("[voice] transcription failed", { status: res.status });
    if (res.status === 402) throw new JournalError("credits", "AI credits have run out for this workspace.");
    if (res.status === 429) throw new JournalError("rate_limit", "Voice is busy right now. Please wait a moment.");
    throw new JournalError("transcription", "Transcription failed. Please try again or switch to text.");
  }
  const raw = await res.text();
  let done = "";
  let deltas = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const ev = JSON.parse(payload) as { type?: string; text?: string; delta?: string };
      if (ev.type === "transcript.text.done" && ev.text) done = ev.text;
      else if (ev.type === "transcript.text.delta" && ev.delta) deltas += ev.delta;
    } catch { /* ignore keepalives */ }
  }
  const text = (done || deltas).trim();
  if (!text) throw new JournalError("empty", "I didn't catch anything. Please try again.");
  return text;
}

// ---------- Turn-based: speech ----------
/** Speaks an assistant message the caller owns (never arbitrary text). Returns a complete WAV. */
export async function speakMessage(db: Db, messageId: string) {
  const { data: m } = await db.from("journal_messages").select("id, role, content").eq("id", messageId).maybeSingle();
  if (!m || m.role !== "assistant") throw new JournalError("not_found", "Nothing to play.");
  const cfg = voiceConfig();
  const ai = aiConfig();
  const text = m.content.slice(0, 1200);
  const res = await fetch(`${ai.baseURL}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ai.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.ttsModel,
      contents: [{ role: "user", parts: [{ text: `Say calmly and warmly, at an unhurried pace: ${text}` }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: cfg.ttsVoice } } } },
      stream_format: "audio",
    }),
  });
  if (!res.ok) {
    console.error("[voice] tts failed", { status: res.status });
    throw new JournalError("tts", "Audio playback isn't available right now. The reply is shown as text.");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new JournalError("tts", "Audio playback isn't available right now. The reply is shown as text.");
  return { audio: buf.toString("base64"), mime: res.headers.get("content-type")?.split(";")[0] || "audio/wav" };
}

// ---------- Realtime ----------
/** Mints a short-lived OpenAI Realtime client secret. The permanent key never leaves the server. */
export async function createRealtimeSecret(db: Db, userId: string, sessionId: string) {
  const cfg = voiceConfig();
  if (!cfg.openaiKey) throw new JournalError("unavailable", "Live voice isn't set up yet. Using turn-by-turn voice instead.");
  const { session, profile } = await ownedVoiceSession(db, userId, sessionId);
  // Small context: a few memories relevant to recent reflections, never full history.
  const { data: recent } = await db.from("journal_entries").select("summary").not("summary", "is", null).order("completed_at", { ascending: false }).limit(2);
  const query = (recent ?? []).map((r) => r.summary).join(" ").slice(0, 800);
  const memories = query ? await retrieveMemories(db, userId, query) : [];
  const instructions = [
    companionSystemPrompt({
      name: profile?.display_name?.split(" ")[0],
      style: profile?.reflection_style,
      rollingSummary: session.rolling_summary,
      memories: memories.slice(0, 6).map((m) => ({ content: m.content, date: m.created_at.slice(0, 10) })),
    }),
    "You are speaking aloud. Keep each reply to one or two short spoken sentences and ask one question. Speak calmly.",
    `If the user expresses intent to seriously harm themselves or someone else, stop the reflection and say: ${SAFETY_RESPONSE}`,
  ].join("\n\n");
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 120 },
      session: {
        type: "realtime",
        model: cfg.realtimeModel,
        instructions,
        audio: {
          input: { transcription: { model: cfg.realtimeTranscriptionModel }, turn_detection: { type: "server_vad", interrupt_response: true, create_response: true } },
          output: { voice: cfg.realtimeVoice },
        },
      },
    }),
  });
  if (!res.ok) {
    console.error("[voice] realtime secret failed", { status: res.status });
    throw new JournalError("unavailable", "Live voice is unavailable right now. You can use turn-by-turn voice instead.");
  }
  const j = (await res.json()) as { value?: string; expires_at?: number };
  if (!j.value) throw new JournalError("unavailable", "Live voice is unavailable right now.");
  return { clientSecret: j.value, expiresAt: j.expires_at ?? null, maxSessionMinutes: cfg.maxSessionMinutes, idleTimeoutSeconds: cfg.idleTimeoutSeconds };
}

/**
 * Persists one finalized realtime turn. `itemId` (the provider's item id) makes saves idempotent,
 * so reconnects or repeated events never duplicate messages. User turns go through the same safety check.
 */
export async function saveRealtimeTurn(db: Db, userId: string, sessionId: string, role: "user" | "assistant", text: string, itemId: string) {
  await ownedVoiceSession(db, userId, sessionId);
  const content = text.trim().slice(0, 4000);
  if (!content) return { saved: false, safety: false };
  const { error } = await db.from("journal_messages").insert({ session_id: sessionId, user_id: userId, role, content, client_item_id: itemId.slice(0, 120) });
  if (error && error.code !== "23505") throw new JournalError("db", "Couldn't save part of the transcript.");
  if (role === "user" && needsSafetyResponse(content)) {
    await db.from("journal_messages").insert({ session_id: sessionId, user_id: userId, role: "assistant", content: SAFETY_RESPONSE, client_item_id: `${itemId.slice(0, 100)}:safety` });
    return { saved: !error, safety: true, safetyMessage: SAFETY_RESPONSE };
  }
  return { saved: !error, safety: false };
}
