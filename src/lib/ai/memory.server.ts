import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { aiConfig } from "./config.server";

type Db = SupabaseClient<Database>;

/** Central memory rules — tune here, not across the codebase. */
export const MEMORY = {
  minConfidence: 0.6,
  minImportance: 0.5,
  minChars: 12,
  maxChars: 300,
  retrieveCount: 8,
  minSimilarity: 0.55, // below this a memory is treated as unrelated
  duplicateSimilarity: 0.9, // at/above this a candidate updates an existing memory
  identicalSimilarity: 0.97, // at/above this nothing changes but importance/reference
};

export const MEMORY_TYPES = [
  "person", "goal", "preference", "event", "decision", "concern",
  "achievement", "project", "relationship", "habit", "belief", "other",
] as const;

// Moment-bound filler that rarely matters later.
const TRIVIAL = [
  /\b(right now|this morning|today|tonight|at the moment|currently sitting)\b.*\b(coffee|tea|breakfast|lunch|car|traffic|weather|rain|tired)\b/i,
  /^(had|drank|ate|sitting|traffic|the weather)\b/i,
];

export type Candidate = { type: string; content: string; importance: number; confidence: number };

export function filterCandidates(cands: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return cands
    .map((c) => ({ ...c, content: c.content.replace(/\s+/g, " ").trim().slice(0, MEMORY.maxChars) }))
    .filter((c) => {
      const key = c.content.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return (
        c.content.length >= MEMORY.minChars &&
        c.confidence >= MEMORY.minConfidence &&
        c.importance >= MEMORY.minImportance &&
        !TRIVIAL.some((r) => r.test(c.content))
      );
    })
    .map((c) => ({ ...c, type: (MEMORY_TYPES as readonly string[]).includes(c.type) ? c.type : "other" }));
}

export function embeddingModel() {
  return process.env["EMBEDDING_MODEL"] || "google/gemini-embedding-2";
}

/** embed-memory: one batched request; vectors aligned by index. Throws on failure. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const { apiKey, baseURL } = aiConfig();
  const res = await fetch(`${baseURL}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: embeddingModel(), input: texts }),
  });
  if (!res.ok) {
    console.error("[embed] failed", { status: res.status });
    throw new Error(`embedding_${res.status}`);
  }
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  const out: number[][] = Array.from({ length: texts.length });
  for (const d of json.data) out[d.index] = d.embedding;
  if (out.some((v) => !v?.length)) throw new Error("embedding_missing");
  return out;
}

const toVec = (v: number[]) => `[${v.join(",")}]`;

export async function memoryEnabled(db: Db, userId: string) {
  const { data } = await db.from("profiles").select("ai_memory_enabled").eq("id", userId).maybeSingle();
  return data?.ai_memory_enabled ?? true;
}

async function nearest(db: Db, vec: number[]) {
  const { data, error } = await db.rpc("match_memories", {
    query_embedding: toVec(vec),
    match_count: 1,
    min_similarity: MEMORY.duplicateSimilarity,
  });
  if (error) throw error;
  return data?.[0];
}

/** Pipeline after analysis: filter → embed → dedupe → store. Never throws. */
export async function saveEntryMemories(db: Db, userId: string, entryId: string, cands: Candidate[]) {
  const stats = { candidates: cands.length, kept: 0, inserted: 0, updated: 0, unchanged: 0, pendingEmbedding: 0 };
  try {
    if (!(await memoryEnabled(db, userId))) return stats;
    const kept = filterCandidates(cands);
    stats.kept = kept.length;
    if (!kept.length) return stats;
    let vectors: number[][] | null = null;
    try {
      vectors = await embedTexts(kept.map((c) => c.content));
    } catch {
      vectors = null; // stored as failed; retried later
    }
    for (const [i, c] of kept.entries()) {
      const vec = vectors?.[i];
      const base = {
        memory_type: c.type,
        importance_score: c.importance,
        confidence_score: c.confidence,
        journal_entry_id: entryId,
      };
      if (!vec) {
        await db.from("memories").insert({ user_id: userId, content: c.content, ...base, embedding_status: "failed", embedding_error: "Will retry" });
        stats.pendingEmbedding++;
        continue;
      }
      const dup = await nearest(db, vec).catch(() => undefined);
      if (dup && dup.similarity >= MEMORY.identicalSimilarity) {
        await db.from("memories").update({ importance_score: Math.max(c.importance, 0) }).eq("id", dup.id);
        stats.unchanged++;
      } else if (dup) {
        // Newer wording replaces the old one; the old text is kept as lineage.
        await db
          .from("memories")
          .update({ ...base, content: c.content, previous_content: dup.content, embedding_v: toVec(vec), embedding_model: embeddingModel(), embedding_status: "ready", embedding_error: null })
          .eq("id", dup.id);
        stats.updated++;
      } else {
        await db.from("memories").insert({ user_id: userId, content: c.content, ...base, embedding_v: toVec(vec), embedding_model: embeddingModel(), embedding_status: "ready" });
        stats.inserted++;
      }
    }
  } catch (e) {
    console.error("[memory] pipeline failed", { name: (e as Error)?.name });
  }
  return stats;
}

/** Re-embeds memories whose embedding failed or whose content was edited. */
export async function retryPendingEmbeddings(db: Db, limit = 20) {
  const { data } = await db.from("memories").select("id, content").neq("embedding_status", "ready").limit(limit);
  if (!data?.length) return 0;
  try {
    const vecs = await embedTexts(data.map((m) => m.content));
    await Promise.all(
      data.map((m, i) =>
        db.from("memories").update({ embedding_v: toVec(vecs[i]!), embedding_model: embeddingModel(), embedding_status: "ready", embedding_error: null }).eq("id", m.id),
      ),
    );
    return data.length;
  } catch {
    await db.from("memories").update({ embedding_status: "failed", embedding_error: "Will retry" }).in("id", data.map((m) => m.id));
    return 0;
  }
}

export type RetrievedMemory = { id: string; content: string; memory_type: string; created_at: string; similarity: number };

/** Relevant memories for the latest message. Returns [] on any failure so chat keeps working. */
export async function retrieveMemories(db: Db, userId: string, text: string): Promise<RetrievedMemory[]> {
  try {
    if (!(await memoryEnabled(db, userId))) return [];
    const [vec] = await embedTexts([text.slice(0, 2000)]);
    const { data, error } = await db.rpc("match_memories", {
      query_embedding: toVec(vec!),
      match_count: MEMORY.retrieveCount,
      min_similarity: MEMORY.minSimilarity,
    });
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length)
      await db.from("memories").update({ last_referenced_at: new Date().toISOString() }).in("id", rows.map((r) => r.id));
    return rows;
  } catch (e) {
    console.error("[memory] retrieval skipped", { name: (e as Error)?.name });
    return [];
  }
}

/** Edit a memory's text and re-embed it (only when content actually changes). */
export async function editMemory(db: Db, id: string, content: string) {
  const clean = content.replace(/\s+/g, " ").trim().slice(0, MEMORY.maxChars);
  const { data: cur, error } = await db.from("memories").select("id, content").eq("id", id).maybeSingle();
  if (error || !cur) throw new Error("not_found");
  if (cur.content === clean) return { reembedded: false };
  let patch: Database["public"]["Tables"]["memories"]["Update"] = { content: clean, embedding_status: "pending", embedding_v: null };
  try {
    const [vec] = await embedTexts([clean]);
    patch = { content: clean, embedding_v: toVec(vec!), embedding_model: embeddingModel(), embedding_status: "ready", embedding_error: null };
  } catch {
    patch.embedding_status = "failed";
    patch.embedding_error = "Will retry";
  }
  const { error: uErr } = await db.from("memories").update(patch).eq("id", id);
  if (uErr) throw new Error("db");
  return { reembedded: patch.embedding_status === "ready" };
}
