import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelMessage } from "ai";
import type { Database } from "@/integrations/supabase/types";
import { CONTEXT } from "./config.server";
import { AiError, generateObject, generateReply } from "./gateway.server";
import { ANALYSIS_SYSTEM_PROMPT, ROLLING_SUMMARY_PROMPT, companionSystemPrompt } from "./prompts.server";
import { SAFETY_RESPONSE, needsSafetyResponse } from "./safety.server";
import { analysisWireSchema, validateAnalysis } from "./analysis";
import { PLACEHOLDER_PREFIX } from "../companion/types";
import { retrieveMemories, saveEntryMemories, retryPendingEmbeddings } from "./memory.server";
import { embedEntrySummary } from "./ask.server";
import { linkEntryTags } from "./tags.server";

type Db = SupabaseClient<Database>;

export class JournalError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function ownedSession(db: Db, sessionId: string) {
  // RLS guarantees only the caller's rows are visible; absence = not theirs or missing.
  const { data, error } = await db
    .from("journal_sessions")
    .select("id, status, session_type, started_at, rolling_summary, rolling_summary_count")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new JournalError("db", "Couldn't load this reflection.");
  if (!data) throw new JournalError("not_found", "This reflection wasn't found.");
  return data;
}

async function allMessages(db: Db, sessionId: string) {
  const { data, error } = await db
    .from("journal_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw new JournalError("db", "Couldn't load messages.");
  return data;
}

const toModel = (rows: { role: string; content: string }[]): ModelMessage[] =>
  rows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content.startsWith(PLACEHOLDER_PREFIX) ? r.content.slice(PLACEHOLDER_PREFIX.length) : r.content,
    }));

async function refreshRollingSummary(
  db: Db,
  session: Awaited<ReturnType<typeof ownedSession>>,
  rows: { role: string; content: string }[],
) {
  const olderCount = Math.max(0, rows.length - CONTEXT.recentMessages);
  if (olderCount - session.rolling_summary_count < CONTEXT.summarizeEvery) return session.rolling_summary;
  const older = rows.slice(session.rolling_summary_count, olderCount);
  const text = older.map((m) => `${m.role}: ${m.content}`).join("\n");
  try {
    const summary = await generateReply(
      ROLLING_SUMMARY_PROMPT,
      [{ role: "user", content: `${session.rolling_summary ? `Previous summary: ${session.rolling_summary}\n\n` : ""}${text}` }],
      "analysis",
    );
    await db.from("journal_sessions").update({ rolling_summary: summary, rolling_summary_count: olderCount }).eq("id", session.id);
    return summary;
  } catch {
    return session.rolling_summary; // non-fatal
  }
}

export async function sendMessage(db: Db, userId: string, sessionId: string, message: string) {
  const text = message.trim().slice(0, CONTEXT.maxMessageChars);
  if (!text) throw new JournalError("invalid", "Write something first.");
  const session = await ownedSession(db, sessionId);
  if (session.status === "completed") throw new JournalError("completed", "This reflection is already finished.");
  if (session.status === "paused") throw new JournalError("paused", "Resume the reflection to keep writing.");

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db
    .from("journal_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", since);
  if ((count ?? 0) >= CONTEXT.maxUserMessagesPerMinute)
    throw new JournalError("rate_limit", "You're writing faster than the companion can keep up. Wait a moment.");

  const { data: userMsg, error: uErr } = await db
    .from("journal_messages")
    .insert({ session_id: sessionId, user_id: userId, role: "user", content: text })
    .select("id, role, content, created_at")
    .single();
  if (uErr) throw new JournalError("db", "Couldn't save your message.");

  let reply: string;
  let safety = false;
  if (needsSafetyResponse(text)) {
    reply = SAFETY_RESPONSE;
    safety = true;
  } else {
    const rows = await allMessages(db, sessionId);
    const rolling = await refreshRollingSummary(db, session, rows);
    const { data: profile } = await db.from("profiles").select("display_name, reflection_style").eq("id", userId).maybeSingle();
    const memories = await retrieveMemories(db, userId, text);
    const system = companionSystemPrompt({
      name: profile?.display_name?.split(" ")[0],
      style: profile?.reflection_style,
      rollingSummary: rolling,
      memories: memories.map((m) => ({ content: m.content, date: m.created_at.slice(0, 10) })),
    });
    try {
      reply = await generateReply(system, toModel(rows.slice(-CONTEXT.recentMessages)));
    } catch (e) {
      // Your message is kept; the client can ask again via retryReply.
      throw new JournalError("ai", e instanceof AiError ? e.message : "The companion couldn't respond just now.");
    }
  }

  const { data: aMsg, error: aErr } = await db
    .from("journal_messages")
    .insert({ session_id: sessionId, user_id: userId, role: "assistant", content: reply })
    .select("id, role, content, created_at")
    .single();
  if (aErr) throw new JournalError("db", "Couldn't save the reply.");
  return { userMessage: userMsg, assistantMessage: aMsg, safety };
}

/** Generates a reply for the last unanswered user message (used after an AI failure). */
export async function retryReply(db: Db, userId: string, sessionId: string) {
  const session = await ownedSession(db, sessionId);
  if (session.status === "completed") throw new JournalError("completed", "This reflection is already finished.");
  const rows = await allMessages(db, sessionId);
  const last = rows[rows.length - 1];
  if (!last || last.role !== "user") throw new JournalError("invalid", "Nothing to retry.");
  const reply = needsSafetyResponse(last.content)
    ? SAFETY_RESPONSE
    : await (async () => {
        const { data: profile } = await db.from("profiles").select("display_name, reflection_style").eq("id", userId).maybeSingle();
        const memories = await retrieveMemories(db, userId, last.content);
        try {
          return await generateReply(
            companionSystemPrompt({ name: profile?.display_name?.split(" ")[0], style: profile?.reflection_style, rollingSummary: session.rolling_summary, memories: memories.map((m) => ({ content: m.content, date: m.created_at.slice(0, 10) })) }),
            toModel(rows.slice(-CONTEXT.recentMessages)),
          );
        } catch (e) {
          throw new JournalError("ai", e instanceof AiError ? e.message : "The companion couldn't respond just now.");
        }
      })();
  const { data, error } = await db
    .from("journal_messages")
    .insert({ session_id: sessionId, user_id: userId, role: "assistant", content: reply })
    .select("id, role, content, created_at")
    .single();
  if (error) throw new JournalError("db", "Couldn't save the reply.");
  return { assistantMessage: data };
}

function deterministicMeta(rows: { role: string; content: string }[]) {
  const userText = rows.filter((m) => m.role === "user").map((m) => m.content.trim());
  const firstLine = (userText[0] ?? "").split(/[.!?\n]/)[0]?.trim() ?? "";
  const joined = userText.join(" ");
  return {
    title: firstLine ? (firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine) : "Untitled reflection",
    preview: joined.length > 180 ? joined.slice(0, 177) + "…" : joined,
    word_count: joined.split(/\s+/).filter(Boolean).length,
    message_count: rows.length,
  };
}

/**
 * Finishes the session: entry is always saved first, then analysis runs only if the
 * analysis quota allows it. Quota or analysis failure never loses the entry.
 */
export async function finishSession(
  db: Db,
  userId: string,
  sessionId: string,
  canAnalyze: () => Promise<boolean> = async () => true,
) {
  const session = await ownedSession(db, sessionId);
  const rows = await allMessages(db, sessionId);
  if (!rows.some((m) => m.role === "user")) throw new JournalError("invalid", "Write something before finishing.");

  const { data: existing } = await db.from("journal_entries").select("id, analysis_status").eq("session_id", sessionId).maybeSingle();
  const now = new Date().toISOString();
  let entryId = existing?.id;
  if (!entryId) {
    const { data, error } = await db
      .from("journal_entries")
      .insert({
        user_id: userId,
        session_id: sessionId,
        session_type: session.session_type,
        started_at: session.started_at,
        completed_at: now,
        analysis_status: "pending",
        ...deterministicMeta(rows),
      })
      .select("id")
      .single();
    if (error) throw new JournalError("db", "Couldn't save the entry.");
    entryId = data.id;
  }
  if (session.status !== "completed") {
    const { error } = await db.from("journal_sessions").update({ status: "completed", ended_at: now }).eq("id", sessionId);
    if (error) throw new JournalError("db", "Couldn't finish the reflection.");
  }
  if (existing?.analysis_status === "complete") return { entryId, analysisOk: true, analysisDeferred: false };
  if (!(await canAnalyze())) return { entryId, analysisOk: false, analysisDeferred: true };
  const analysis = await analyzeEntry(db, entryId);
  return { entryId, analysisOk: analysis.ok, analysisDeferred: false };
}

export async function analyzeEntry(db: Db, entryId: string): Promise<{ ok: boolean }> {
  const { data: entry, error } = await db.from("journal_entries").select("id, session_id, title, user_id").eq("id", entryId).maybeSingle();
  if (error || !entry) throw new JournalError("not_found", "This entry wasn't found.");
  if (!entry.session_id) throw new JournalError("invalid", "This entry has no transcript to analyse.");
  const rows = await allMessages(db, entry.session_id);
  let transcript = toModel(rows)
    .map((m) => `${m.role === "user" ? "User" : "Companion"}: ${m.content}`)
    .join("\n");
  if (transcript.length > CONTEXT.maxTranscriptChars) transcript = transcript.slice(-CONTEXT.maxTranscriptChars);

  try {
    const raw = await generateObject(ANALYSIS_SYSTEM_PROMPT, `Transcript:\n${transcript}`, analysisWireSchema);
    const a = validateAnalysis(raw);
    const { error: uErr } = await db
      .from("journal_entries")
      .update({
        title: a.title,
        summary: a.summary,
        narrative: a.narrative,
        preview: a.summary,
        analysis: a,
        analysis_status: "complete",
        analysis_error: null,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", entryId);
    if (uErr) throw uErr;
    // Memory pipeline runs after the entry is safely saved; it never fails the entry.
    await linkEntryTags(db, entry.user_id, entryId, a.topics, a.people);
    await embedEntrySummary(db, entryId, `${a.title}. ${a.summary} ${a.topics.join(", ")}`);
    await retryPendingEmbeddings(db, 10).catch(() => 0);
    const memoryStats = await saveEntryMemories(db, entry.user_id, entryId, a.memory_candidates);
    console.info("[memory] saved", memoryStats);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof AiError ? e.message : "The analysis couldn't be completed.";
    console.error("[analysis] failed", { entryId, kind: e instanceof AiError ? e.code : "validation" });
    await db.from("journal_entries").update({ analysis_status: "failed", analysis_error: msg }).eq("id", entryId);
    return { ok: false };
  }
}
