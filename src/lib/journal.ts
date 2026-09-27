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

export type EntryFilters = { search?: string; range?: "all" | "7d" | "30d" | "year" };

export async function fetchEntries(filters: EntryFilters = {}) {
  let q = supabase
    .from("journal_entries")
    .select("id, title, preview, session_type, mood_score, started_at, message_count")
    .order("started_at", { ascending: false })
    .limit(200);
  const s = filters.search?.trim().replace(/[%,()]/g, " ");
  if (s) q = q.or(`title.ilike.%${s}%,preview.ilike.%${s}%,summary.ilike.%${s}%`);
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
    .select("id, title, preview, summary, narrative, analysis, analysis_status, analysis_error, session_type, mood_score, started_at, completed_at, session_id, word_count, dismissed_goal_candidates")
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
