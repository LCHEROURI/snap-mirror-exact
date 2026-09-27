import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { cleanPersonName, cleanTopic, personKey, personRelationship } from "../tags";

type Db = SupabaseClient<Database>;

/** Links an entry to its extracted topics and people. Idempotent; runs under the user's RLS. Never throws. */
export async function linkEntryTags(db: Db, userId: string, entryId: string, topics: string[], people: string[]) {
  try {
    const tnames = [...new Map(topics.map(cleanTopic).filter(Boolean).map((t) => [t.toLowerCase(), t])).values()];
    if (tnames.length) {
      const { data: existing } = await db.from("topics").select("id, name");
      const byKey = new Map((existing ?? []).map((t) => [t.name.toLowerCase(), t.id]));
      const missing = tnames.filter((t) => !byKey.has(t.toLowerCase()));
      if (missing.length) {
        const { data: ins } = await db.from("topics").insert(missing.map((name) => ({ user_id: userId, name }))).select("id, name");
        for (const t of ins ?? []) byKey.set(t.name.toLowerCase(), t.id);
      }
      const rows = tnames.map((t) => byKey.get(t.toLowerCase())).filter(Boolean).map((topic_id) => ({ entry_id: entryId, topic_id: topic_id!, user_id: userId }));
      if (rows.length) await db.from("entry_topics").upsert(rows, { onConflict: "entry_id,topic_id", ignoreDuplicates: true });
    }

    const rels = new Map(people.map((p) => [personKey(p), personRelationship(p)]));
    const pnames = [...new Map(people.map((p) => [personKey(p), cleanPersonName(p)])).entries()].filter(([k]) => k.length > 1);
    if (pnames.length) {
      const { data: existing } = await db.from("people").select("id, name, name_key");
      const byKey = new Map((existing ?? []).map((p) => [p.name_key ?? p.name.toLowerCase(), p.id]));
      const missing = pnames.filter(([k]) => !byKey.has(k));
      if (missing.length) {
        const { data: ins } = await db.from("people").insert(missing.map(([k, name]) => ({ user_id: userId, name, name_key: k, relationship: rels.get(k) ?? null }))).select("id, name_key");
        for (const p of ins ?? []) byKey.set(p.name_key!, p.id);
      }
      const rows = pnames.map(([k]) => byKey.get(k)).filter(Boolean).map((person_id) => ({ entry_id: entryId, person_id: person_id!, user_id: userId }));
      if (rows.length) await db.from("entry_people").upsert(rows, { onConflict: "entry_id,person_id", ignoreDuplicates: true });
    }
  } catch (e) {
    console.error("[tags] link failed", { name: (e as Error)?.name });
  }
}

/** Links older analysed entries that predate tagging. Reuses stored analysis; no AI calls. */
export async function backfillTags(db: Db, userId: string) {
  const { data: entries } = await db.from("journal_entries").select("id, analysis").eq("analysis_status", "complete").limit(100);
  const { data: linked } = await db.from("entry_topics").select("entry_id");
  const { data: linkedP } = await db.from("entry_people").select("entry_id");
  const done = new Set([...(linked ?? []), ...(linkedP ?? [])].map((r) => r.entry_id));
  let n = 0;
  for (const e of entries ?? []) {
    if (done.has(e.id)) continue;
    const a = (e.analysis ?? {}) as { topics?: string[]; people?: string[] };
    if (!a.topics?.length && !a.people?.length) continue;
    await linkEntryTags(db, userId, e.id, a.topics ?? [], a.people ?? []);
    if (++n >= 30) break;
  }
  return n;
}
