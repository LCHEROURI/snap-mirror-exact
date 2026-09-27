import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { aiConfig } from "./config.server";
import { AiError, generateObject } from "./gateway.server";
import { embedTexts, memoryEnabled } from "./memory.server";

type Db = SupabaseClient<Database>;

export const ASK = {
  memoryCount: 8,
  memoryMinSimilarity: 0.55,
  entryCount: 6,
  entryMinSimilarity: 0.5,
  maxQuestionChars: 500,
};

export const INSUFFICIENT = "I don't have enough journal history to answer that confidently yet.";
const vec = (v: number[]) => `[${v.join(",")}]`;

/** Indexes an entry's summary for search. Never throws. */
export async function embedEntrySummary(db: Db, entryId: string, text: string) {
  try {
    const [v] = await embedTexts([text.slice(0, 2000)]);
    await db.from("journal_entries").update({ summary_embedding: vec(v!), summary_embedding_status: "ready" }).eq("id", entryId);
  } catch {
    await db.from("journal_entries").update({ summary_embedding_status: "failed" }).eq("id", entryId);
  }
}

async function backfillEntries(db: Db) {
  const { data } = await db
    .from("journal_entries")
    .select("id, title, summary")
    .eq("analysis_status", "complete")
    .neq("summary_embedding_status", "ready")
    .limit(10);
  for (const e of data ?? []) await embedEntrySummary(db, e.id, `${e.title}. ${e.summary ?? ""}`);
}

/** Server-side date-range interpretation (UTC). Returns undefined for no range. */
export function parseRange(q: string, now = new Date()): { from: Date; to: Date; label: string } | undefined {
  const s = q.toLowerCase();
  const day = 86_400_000;
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(startOfDay.getTime() + day);
  const m = s.match(/(?:past|last)\s+(\d{1,3})\s+days?/);
  if (m) return { from: new Date(tomorrow.getTime() - Number(m[1]) * day), to: tomorrow, label: `past ${m[1]} days` };
  if (/\btoday\b/.test(s)) return { from: startOfDay, to: tomorrow, label: "today" };
  if (/\bthis week\b/.test(s)) {
    const dow = (startOfDay.getUTCDay() + 6) % 7;
    return { from: new Date(startOfDay.getTime() - dow * day), to: tomorrow, label: "this week" };
  }
  if (/\blast week\b/.test(s)) {
    const dow = (startOfDay.getUTCDay() + 6) % 7;
    const thisMon = startOfDay.getTime() - dow * day;
    return { from: new Date(thisMon - 7 * day), to: new Date(thisMon), label: "last week" };
  }
  if (/\bthis month\b/.test(s))
    return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: tomorrow, label: "this month" };
  if (/\blast month\b/.test(s))
    return {
      from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
      to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      label: "last month",
    };
  if (/\b(recently|lately)\b/.test(s)) return { from: new Date(tomorrow.getTime() - 30 * day), to: tomorrow, label: "the past 30 days" };
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const mi = months.findIndex((mn) => new RegExp(`\\b(in|during)\\s+${mn}\\b`).test(s));
  if (mi >= 0) {
    const y = mi > now.getUTCMonth() ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
    return { from: new Date(Date.UTC(y, mi, 1)), to: new Date(Date.UTC(y, mi + 1, 1)), label: months[mi]! };
  }
  return undefined;
}

const wire = z.object({
  answer: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  related: z.array(z.object({ ref: z.string(), reason: z.string() })),
});

export type AskResult = {
  answer: string;
  confidence: "high" | "medium" | "low";
  related_entries: { entry_id: string; title: string; date: string; reason: string }[];
  range?: string | undefined;
};

export class AskError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const SYSTEM = [
  "You answer the user's question about their own private journal, using ONLY the evidence provided.",
  "Speak to the user in second person: 'You mentioned…', 'In several entries…', 'Your journal shows…', 'One recurring theme appears to be…'.",
  "Never say 'you definitely', 'you always' or claim to know why they do things. Never diagnose or use clinical labels. You are not a therapist.",
  "Never invent facts, names or dates that are not in the evidence. If the evidence conflicts, describe the conflict and which is more recent.",
  `If the evidence does not really answer the question, set confidence to "low" and answer exactly: "${INSUFFICIENT}"`,
  "Keep the answer to 2-5 sentences. related lists up to 5 entry refs (E1, E2, …) that you actually relied on, each with a short reason (under 12 words).",
].join("\n");

export async function askJournal(db: Db, userId: string, question: string): Promise<AskResult> {
  const q = question.replace(/\s+/g, " ").trim().slice(0, ASK.maxQuestionChars);
  if (q.length < 3) throw new AskError("invalid", "Ask a question first.");

  const { count: total } = await db.from("journal_entries").select("id", { count: "exact", head: true });
  if (!total) throw new AskError("no_history", "Your journal needs a little history before you can ask questions across it.");

  const range = parseRange(q);
  await backfillEntries(db).catch(() => undefined);

  let qv: number[];
  try {
    [qv] = (await embedTexts([q])) as [number[]];
  } catch {
    throw new AskError("search", "Couldn't search your journal just now. Please try again.");
  }

  const [memRes, entRes] = await Promise.all([
    (async () => (await memoryEnabled(db, userId))
      ? db.rpc("match_memories", { query_embedding: vec(qv), match_count: ASK.memoryCount, min_similarity: ASK.memoryMinSimilarity })
      : { data: [], error: null })(),
    db.rpc("match_entries", {
      query_embedding: vec(qv),
      match_count: ASK.entryCount,
      min_similarity: range ? 0.3 : ASK.entryMinSimilarity, // date filter already narrows the pool
      ...(range ? { from_ts: range.from.toISOString(), to_ts: range.to.toISOString() } : {}),
    }),
  ]);
  if (entRes.error || memRes.error) {
    console.error("[ask] retrieval failed");
    throw new AskError("search", "Couldn't search your journal just now. Please try again.");
  }
  let memories = memRes.data ?? [];
  const entries: { id: string; title: string; summary: string | null; completed_at: string; similarity: number }[] = [...(entRes.data ?? [])];

  // Pull in source entries of strong memories (ownership enforced by RLS).
  const extraIds = [...new Set(memories.map((m) => m.journal_entry_id).filter(Boolean))].filter((id) => !entries.some((e) => e.id === id)) as string[];
  if (extraIds.length && entries.length < ASK.entryCount) {
    let qb = db.from("journal_entries").select("id, title, summary, completed_at").in("id", extraIds.slice(0, ASK.entryCount - entries.length));
    if (range) qb = qb.gte("completed_at", range.from.toISOString()).lt("completed_at", range.to.toISOString());
    const { data } = await qb;
    for (const e of data ?? []) entries.push({ ...e, similarity: 0 });
  }
  if (range) {
    memories = memories.filter((m) => entries.some((e) => e.id === m.journal_entry_id));
  }

  if (!entries.length && !memories.length) return { answer: INSUFFICIENT, confidence: "low", related_entries: [], range: range?.label };

  const refs = entries.map((e, i) => ({ ref: `E${i + 1}`, ...e }));
  const evidence = [
    range ? `Question time range: ${range.label} (${range.from.toISOString().slice(0, 10)} to ${range.to.toISOString().slice(0, 10)}).` : "",
    "Journal entries:",
    ...refs.map((e) => `${e.ref} (${e.completed_at.slice(0, 10)}) "${e.title}": ${(e.summary ?? "").slice(0, 600)}`),
    memories.length ? "Saved memories:" : "",
    ...memories.map((m) => `- (${m.created_at.slice(0, 10)}) ${m.content}`),
  ].filter(Boolean).join("\n");

  let raw: z.infer<typeof wire>;
  try {
    raw = await generateObject(SYSTEM, `Evidence:\n${evidence}\n\nQuestion: ${q}`, wire, aiConfig().askModel);
  } catch (e) {
    throw new AskError("ai", e instanceof AiError ? (e.code === "malformed" ? "The answer came back in an unexpected format. Please try again." : e.message) : "Couldn't answer just now. Please try again.");
  }
  const parsed = wire.safeParse(raw);
  if (!parsed.success) throw new AskError("ai", "The answer came back in an unexpected format. Please try again.");

  const answer = parsed.data.answer.trim().slice(0, 1500) || INSUFFICIENT;
  const confidence = answer === INSUFFICIENT ? "low" : parsed.data.confidence;
  const seen = new Set<string>();
  const related_entries = parsed.data.related
    .map((r) => ({ r, e: refs.find((x) => x.ref === r.ref.trim().toUpperCase()) }))
    .filter(({ e }) => e && !seen.has(e.id) && seen.add(e.id))
    .slice(0, 5)
    .map(({ r, e }) => ({ entry_id: e!.id, title: e!.title, date: e!.completed_at, reason: r.reason.slice(0, 120) }));
  return { answer, confidence, related_entries: confidence === "low" && answer === INSUFFICIENT ? [] : related_entries, range: range?.label };
}

