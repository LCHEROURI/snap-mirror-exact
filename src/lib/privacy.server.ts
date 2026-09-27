// Privacy operations. Every query runs with the signed-in user's own client, so RLS limits it to their rows.
// Never logs journal content — only event type, outcome and user id.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

export function auditLog(event: string, userId: string, ok: boolean, detail?: string) {
  console.info(
    "[privacy]",
    JSON.stringify({
      event,
      userId,
      ok,
      at: new Date().toISOString(),
      ...(detail ? { detail } : {}),
    }),
  );
}

// Explicit columns only: no embeddings, model names, errors or other provider metadata.
const EXPORT = {
  journal_sessions: "id, session_type, status, title, mood_score, started_at, ended_at, created_at",
  journal_messages: "id, session_id, role, content, created_at",
  journal_entries:
    "id, session_id, title, summary, narrative, preview, session_type, mood_score, message_count, word_count, analysis, started_at, completed_at, created_at, updated_at",
  memories:
    "id, journal_entry_id, memory_type, content, importance_score, confidence_score, created_at, updated_at, last_referenced_at",
  topics: "id, name, created_at, updated_at",
  entry_topics: "entry_id, topic_id",
  people: "id, name, relationship, notes, created_at, updated_at",
  entry_people: "entry_id, person_id",
  goals:
    "id, title, description, status, progress, target_date, next_actions, created_from_entry_id, created_at, updated_at",
  goal_checkins: "id, goal_id, note, progress, created_at",
  mood_entries: "id, journal_entry_id, session_id, score, label, note, recorded_at",
  weekly_reports:
    "id, week_start, week_end, summary, themes, wins, challenges, patterns, decisions, goal_progress, next_week, worth_noticing, entry_count, created_at, updated_at",
} as const;
type Table = keyof typeof EXPORT;

async function all(db: Db, table: Table, userId: string) {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select(EXPORT[table])
      .eq("user_id", userId)
      .range(from, from + 999);
    if (error) throw new Error(`export_${table}`);
    out.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function buildExport(db: Db, userId: string, email: string | undefined) {
  const { data: profile, error } = await db
    .from("profiles")
    .select(
      "display_name, first_name, timezone, journaling_intention, preferred_interaction, reflection_style, reminder_preference, ai_memory_enabled, voice_enabled, voice_name, auto_play_responses, weekly_report_enabled, reflection_reminders_enabled, theme, onboarded_at, created_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("export_profile");
  const tables = Object.keys(EXPORT) as Table[];
  const rows = await Promise.all(tables.map((t) => all(db, t, userId)));
  const data = Object.fromEntries(tables.map((t, i) => [t, rows[i]])) as Record<
    Table,
    Record<string, unknown>[]
  >;
  const {
    voice_enabled,
    voice_name,
    auto_play_responses,
    weekly_report_enabled,
    reflection_reminders_enabled,
    theme,
    reminder_preference,
    ...profileRest
  } = profile ?? ({} as Record<string, unknown>);
  const json = {
    exported_at: new Date().toISOString(),
    format: "reflective-export-v1",
    account: { email: email ?? null },
    profile: profileRest,
    preferences: {
      voice_enabled,
      voice_name,
      auto_play_responses,
      weekly_report_enabled,
      reflection_reminders_enabled,
      theme,
      reminder_preference,
    },
    ...data,
  };
  return { jsonText: JSON.stringify(json, null, 2), markdown: toMarkdown(data) };
}

function toMarkdown(d: Record<Table, Record<string, unknown>[]>) {
  const msgs = new Map<string, Record<string, unknown>[]>();
  for (const m of d.journal_messages) {
    const k = String(m["session_id"]);
    msgs.set(k, [...(msgs.get(k) ?? []), m]);
  }
  const entries = [...d.journal_entries].sort((a, b) =>
    String(a["completed_at"]).localeCompare(String(b["completed_at"])),
  );
  const lines = [
    "# My Reflective journal",
    "",
    `Exported ${new Date().toUTCString()}. ${entries.length} entries.`,
    "",
  ];
  for (const e of entries) {
    lines.push(
      `## ${e["title"] ?? "Untitled"}`,
      "",
      `*${new Date(String(e["completed_at"])).toUTCString()}*`,
      "",
    );
    if (e["summary"]) lines.push(`**Summary:** ${e["summary"]}`, "");
    if (e["narrative"]) lines.push(String(e["narrative"]), "");
    const t = (msgs.get(String(e["session_id"])) ?? [])
      .filter((m) => m["role"] !== "system")
      .sort((a, b) => String(a["created_at"]).localeCompare(String(b["created_at"])));
    if (t.length) {
      lines.push("### Transcript", "");
      for (const m of t)
        lines.push(`**${m["role"] === "user" ? "You" : "Reflective"}:** ${m["content"]}`, "");
    }
  }
  if (d.goals.length) {
    lines.push("# Goals", "");
    for (const g of d.goals)
      lines.push(
        `- **${g["title"]}** (${g["status"]})${g["description"] ? ` — ${g["description"]}` : ""}`,
      );
    lines.push("");
  }
  if (d.memories.length) {
    lines.push("# Memories", "");
    for (const m of d.memories) lines.push(`- [${m["memory_type"]}] ${m["content"]}`);
    lines.push("");
  }
  return lines.join("\n");
}

export type DeleteScope = "history" | "memories" | "all_data";
const RPC = {
  history: "delete_journal_history",
  memories: "delete_all_memories",
  all_data: "delete_all_personal_data",
} as const;

export async function runDelete(db: Db, scope: DeleteScope) {
  const { error } = await db.rpc(RPC[scope]);
  if (error) throw new Error("delete_failed");
}
