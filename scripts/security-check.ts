import { createClient } from "@supabase/supabase-js";
const URL = process.env.SUPABASE_URL!, PK = "sb_publishable_yQRq8a4YN_dh1FdyJv4W_g_f3RDdf67";
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let pass = 0, failN = 0;
const ok = (c: boolean, m: string) => { c ? pass++ : failN++; console.log(c ? "PASS" : "FAIL", m); };
async function user(tag: string) {
  const email = `p10-${tag}-${Date.now()}@example.test`, password = "Tst-" + crypto.randomUUID();
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const c = createClient(URL, PK, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });
  return { id: data.user!.id, c };
}
const A = await user("a"), B = await user("b");
try {
  // B creates data through the normal browser path
  const s = await B.c.from("journal_sessions").insert({ session_type: "text", status: "active" }).select().single();
  const sid = s.data!.id;
  await B.c.from("journal_messages").insert({ session_id: sid, role: "user", content: "B private" });
  const e = await B.c.from("journal_entries").insert({ session_id: sid, title: "B entry", session_type: "text", started_at: new Date().toISOString(), completed_at: new Date().toISOString() }).select().single();
  const eid = e.data?.id; ok(!!eid, "B can create own entry " + (e.error?.message ?? ""));
  const g = await B.c.from("goals").insert({ title: "B goal" }).select().single();
  const m = await B.c.from("memories").insert({ content: "B memory", kind: "other", memory_type: "other", journal_entry_id: eid }).select().single();
  ok(!!m.data && !!g.data, "B can create goal+memory " + (m.error?.message ?? g.error?.message ?? ""));
  await B.c.from("topics").insert({ name: "B topic" }); await B.c.from("people").insert({ name: "B person" });
  await B.c.from("mood_entries").insert({ score: 3 });
  await B.c.rpc("consume_ai_quota", { p_kind: "chat", p_limit: 5, p_window_seconds: 60 });

  const tables = ["profiles","journal_sessions","journal_messages","journal_entries","memories","topics","entry_topics","people","entry_people","goals","goal_checkins","mood_entries","weekly_reports","session_summaries","ai_usage"];
  for (const t of tables) {
    const r = await A.c.from(t).select("*").neq("user_id" in {} ? "x" : (t === "profiles" ? "id" : "user_id"), A.id);
    ok(!r.error ? r.data!.length === 0 : true, `A reads no B rows in ${t}`);
  }
  // Writes against B's ids
  const u1 = await A.c.from("journal_entries").update({ title: "hacked" }).eq("id", eid).select();
  ok((u1.data ?? []).length === 0, "A cannot update B entry");
  const u2 = await A.c.from("goals").delete().eq("id", g.data!.id).select();
  ok((u2.data ?? []).length === 0, "A cannot delete B goal");
  const u3 = await A.c.from("memories").update({ content: "x" }).eq("id", m.data!.id).select();
  ok((u3.data ?? []).length === 0, "A cannot edit B memory");
  const i1 = await A.c.from("journal_messages").insert({ session_id: sid, role: "user", content: "inject" });
  ok(!!i1.error, "A cannot insert into B session");
  const i2 = await A.c.from("goals").insert({ title: "spoof", user_id: B.id });
  ok(!!i2.error, "A cannot create rows owned by B");
  const i3 = await A.c.from("ai_usage").insert({ kind: "chat", user_id: B.id });
  ok(!!i3.error, "A cannot spend B's AI quota");
  // RPCs
  await A.c.rpc("delete_journal_entry", { p_entry_id: eid });
  const still = await admin.from("journal_entries").select("id").eq("id", eid);
  ok(still.data!.length === 1, "A's delete_journal_entry on B id does nothing");
  await A.c.rpc("delete_all_personal_data");
  const bg = await admin.from("goals").select("id").eq("user_id", B.id);
  ok(bg.data!.length === 1, "A deleting all own data leaves B intact");
  const vec = "[" + Array(3072).fill(0.01).join(",") + "]";
  const mm = await A.c.rpc("match_memories", { query_embedding: vec, match_count: 10, min_similarity: -1 });
  ok(!mm.error && (mm.data ?? []).length === 0, "A vector search returns none of B's memories " + (mm.error?.message ?? ""));
  const me = await A.c.rpc("match_entries", { query_embedding: vec, match_count: 10, min_similarity: -1, from_ts: null, to_ts: null });
  ok(!me.error && (me.data ?? []).length === 0, "A entry search returns none of B's entries " + (me.error?.message ?? ""));
  const mg = await A.c.rpc("merge_topics", { source_id: crypto.randomUUID(), target_id: crypto.randomUUID() });
  ok(!!mg.error, "merge_topics refuses ids A doesn't own");
  // Anonymous
  const anon = createClient(URL, PK, { auth: { persistSession: false } });
  for (const t of ["journal_entries","memories","goals","journal_messages"]) {
    const r = await anon.from(t).select("id");
    ok(!!r.error || r.data!.length === 0, `signed-out sees nothing in ${t}`);
  }
  const q = await anon.rpc("consume_ai_quota", { p_kind: "chat", p_limit: 5, p_window_seconds: 60 });
  ok(!!q.error, "signed-out cannot use AI quota");
  // Rate limit behaviour
  let last = true;
  for (let i = 0; i < 4; i++) last = (await A.c.rpc("consume_ai_quota", { p_kind: "t", p_limit: 3, p_window_seconds: 60 })).data as boolean;
  ok(last === false, "quota blocks the 4th call when limit is 3");
} finally {
  for (const u of [A, B]) { await u.c.rpc("delete_all_personal_data"); await admin.from("profiles").delete().eq("id", u.id); await admin.auth.admin.deleteUser(u.id); }
  console.log(`\n${pass} passed, ${failN} failed`);
}
