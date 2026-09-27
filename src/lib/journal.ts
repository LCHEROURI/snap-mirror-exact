import { supabase } from "@/integrations/supabase/client";
import { PLACEHOLDER_PREFIX } from "./companion/types";

// Data access for journal sessions, messages and entries.
// All queries run as the signed-in user; RLS enforces ownership and
// user_id defaults to auth.uid() in the database.

export type JournalMessage = { id: string; role: string; content: string; created_at: string };

export function isPlaceholder(content: string) {
  return content.startsWith(PLACEHOLDER_PREFIX);
}
export function displayContent(content: string) {
  return isPlaceholder(content) ? content.slice(PLACEHOLDER_PREFIX.length) : content;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not signed in");
  return data.user.id;
}

export async function createSession() {
  const user_id = await currentUserId();
  const { data, error } = await supabase
    .from("journal_sessions")
    .insert({ user_id, session_type: "text", status: "active" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function fetchActiveSession() {
  const { data, error } = await supabase
    .from("journal_sessions")
    .select("id, started_at")
    .neq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchSession(id: string) {
  const { data, error } = await supabase
    .from("journal_sessions")
    .select("id, status, session_type, started_at, ended_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMessages(sessionId: string): Promise<JournalMessage[]> {
  const { data, error } = await supabase
    .from("journal_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addUserMessage(sessionId: string, content: string) {
  const user_id = await currentUserId();
  const { data, error } = await supabase
    .from("journal_messages")
    .insert({ session_id: sessionId, user_id, role: "user", content })
    .select("id, role, content, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function setSessionStatus(sessionId: string, status: "active" | "paused") {
  const { error } = await supabase.from("journal_sessions").update({ status }).eq("id", sessionId);
  if (error) throw error;
}

/** Deterministic, non-AI metadata for development. Phase 3 replaces title/summary with AI analysis. */
export function deriveEntryMetadata(messages: JournalMessage[]) {
  const userText = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const first = userText[0] ?? "";
  const firstLine = first.split(/[.!?\n]/)[0]?.trim() ?? "";
  const title = firstLine ? (firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine) : "Untitled reflection";
  const joined = userText.join(" ");
  const preview = joined.length > 180 ? joined.slice(0, 177) + "…" : joined;
  const word_count = joined.split(/\s+/).filter(Boolean).length;
  return { title, preview, word_count, message_count: messages.length };
}

export async function finishSession(sessionId: string) {
  const user_id = await currentUserId();
  const session = await fetchSession(sessionId);
  if (!session) throw new Error("Session not found");
  const messages = await fetchMessages(sessionId);
  if (!messages.some((m) => m.role === "user")) throw new Error("Write something before finishing");

  const { data: existing } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();

  const now = new Date().toISOString();
  let entryId = existing?.id;
  if (!entryId) {
    const meta = deriveEntryMetadata(messages);
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({
        user_id,
        session_id: sessionId,
        session_type: session.session_type,
        started_at: session.started_at,
        completed_at: now,
        ...meta,
      })
      .select("id")
      .single();
    if (error) throw error;
    entryId = data.id;
  }
  const { error } = await supabase
    .from("journal_sessions")
    .update({ status: "completed", ended_at: now })
    .eq("id", sessionId);
  if (error) throw error;
  return entryId;
}

export type EntryFilters = { search?: string; range?: "all" | "7d" | "30d" | "year" };

export async function fetchEntries(filters: EntryFilters = {}) {
  let q = supabase
    .from("journal_entries")
    .select("id, title, preview, session_type, mood_score, started_at, message_count")
    .order("started_at", { ascending: false })
    .limit(200);
  const s = filters.search?.trim().replace(/[%,()]/g, " ");
  if (s) q = q.or(`title.ilike.%${s}%,preview.ilike.%${s}%`);
  if (filters.range && filters.range !== "all") {
    const d = new Date();
    if (filters.range === "7d") d.setDate(d.getDate() - 7);
    if (filters.range === "30d") d.setDate(d.getDate() - 30);
    if (filters.range === "year") d.setFullYear(d.getFullYear() - 1);
    q = q.gte("started_at", d.toISOString());
  }
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function fetchEntry(id: string) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, title, preview, session_type, mood_score, started_at, completed_at, session_id, word_count")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function renameEntry(id: string, title: string) {
  const { error } = await supabase.from("journal_entries").update({ title }).eq("id", id);
  if (error) throw error;
}

/** Deletes the entry and its own transcript (session + messages). Nothing else is touched. */
export async function deleteEntry(id: string) {
  const entry = await fetchEntry(id);
  if (!entry) return;
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) throw error;
  if (entry.session_id) {
    const m = await supabase.from("journal_messages").delete().eq("session_id", entry.session_id);
    if (m.error) throw m.error;
    const s = await supabase.from("journal_sessions").delete().eq("id", entry.session_id);
    if (s.error) throw s.error;
  }
}

export function formatDate(iso: string, withTime = false) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: withTime ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}
