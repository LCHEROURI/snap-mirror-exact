// Browser data access for goals, topics, people and mood. RLS scopes every query to the signed-in user;
// user_id columns default to auth.uid(), so the browser never supplies an owner.
import { supabase } from "@/integrations/supabase/client";

export type GoalStatus = "active" | "paused" | "completed" | "archived";
export const GOAL_STATUSES: GoalStatus[] = ["active", "paused", "completed", "archived"];
export type NextAction = { text: string; done: boolean };

function ok<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw r.error;
  return (r.data ?? []) as NonNullable<T>;
}
function one<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data;
}

// ---------- Goals ----------
export async function fetchGoals() {
  const goals = ok(await supabase.from("goals").select("id, title, description, status, target_date, created_from_entry_id, created_at, updated_at").order("updated_at", { ascending: false }));
  const ids = goals.map((g) => g.id);
  const checkins = ids.length ? ok(await supabase.from("goal_checkins").select("goal_id, note, created_at").in("goal_id", ids).order("created_at", { ascending: false })) : [];
  return goals.map((g) => ({ ...g, lastCheckin: checkins.find((c) => c.goal_id === g.id) ?? null }));
}

export async function fetchGoal(id: string) {
  const goal = one(await supabase.from("goals").select("*").eq("id", id).maybeSingle());
  if (!goal) return null;
  const [checkins, source] = await Promise.all([
    supabase.from("goal_checkins").select("id, note, progress, created_at").eq("goal_id", id).order("created_at", { ascending: false }).then(ok),
    goal.created_from_entry_id
      ? supabase.from("journal_entries").select("id, title, completed_at").eq("id", goal.created_from_entry_id).maybeSingle().then(one)
      : Promise.resolve(null),
  ]);
  // Journal mentions: entries whose analysis mentions the goal title (deterministic text match).
  const words = goal.title.split(/\s+/).filter((w) => w.length > 3).slice(0, 3);
  let mentions: { id: string; title: string; completed_at: string }[] = [];
  if (words.length) {
    const r = await supabase.from("journal_entries").select("id, title, completed_at").or(words.map((w) => `summary.ilike.%${w.replace(/[%,()]/g, "")}%`).join(",")).order("completed_at", { ascending: false }).limit(10);
    mentions = r.data ?? [];
  }
  return { goal: { ...goal, next_actions: (goal.next_actions as NextAction[] | null) ?? [] }, checkins, source, mentions };
}

export async function createGoal(v: { title: string; description?: string | null; target_date?: string | null; created_from_entry_id?: string | null; next_actions?: NextAction[] }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("auth");
  return ok(await supabase.from("goals").insert({
    user_id: u.user.id,
    title: v.title.trim().slice(0, 120),
    description: v.description?.trim() || null,
    target_date: v.target_date || null,
    created_from_entry_id: v.created_from_entry_id ?? null,
    next_actions: v.next_actions ?? [],
    status: "active",
  }).select("id").single());
}

export async function updateGoal(id: string, patch: { title?: string; description?: string | null; status?: GoalStatus; target_date?: string | null; next_actions?: NextAction[] }) {
  ok(await supabase.from("goals").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select("id").single());
}

export async function deleteGoal(id: string) {
  ok(await supabase.from("goal_checkins").delete().eq("goal_id", id));
  ok(await supabase.from("goals").delete().eq("id", id));
}

export async function addCheckin(goalId: string, note: string, progress?: number | null) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("auth");
  ok(await supabase.from("goal_checkins").insert({ goal_id: goalId, user_id: u.user.id, note: note.trim().slice(0, 500), progress: progress ?? null }));
  await supabase.from("goals").update({ updated_at: new Date().toISOString() }).eq("id", goalId);
}

export async function dismissGoalCandidate(entryId: string, title: string, current: string[]) {
  ok(await supabase.from("journal_entries").update({ dismissed_goal_candidates: [...new Set([...current, title])] }).eq("id", entryId));
}

// ---------- Topics ----------
export async function fetchTopics() {
  const topics = ok(await supabase.from("topics").select("id, name, created_at").order("name"));
  const links = ok(await supabase.from("entry_topics").select("topic_id, journal_entries(completed_at)"));
  return topics
    .map((t) => {
      const mine = links.filter((l) => l.topic_id === t.id);
      const dates = mine.map((l) => (l.journal_entries as { completed_at: string } | null)?.completed_at).filter(Boolean) as string[];
      const last = dates.sort().at(-1) ?? null;
      const recent = dates.filter((d) => Date.now() - +new Date(d) < 14 * 86_400_000).length;
      return { ...t, count: mine.length, last, recent };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function fetchTopic(id: string) {
  const topic = one(await supabase.from("topics").select("id, name").eq("id", id).maybeSingle());
  if (!topic) return null;
  const links = ok(await supabase.from("entry_topics").select("journal_entries(id, title, summary, completed_at)").eq("topic_id", id));
  const entries = links.map((l) => l.journal_entries as { id: string; title: string; summary: string | null; completed_at: string } | null).filter(Boolean) as { id: string; title: string; summary: string | null; completed_at: string }[];
  entries.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  return { topic, entries };
}

export async function renameTopic(id: string, name: string) {
  const r = await supabase.from("topics").update({ name: name.trim().slice(0, 40), updated_at: new Date().toISOString() }).eq("id", id);
  if (r.error?.code === "23505") throw new Error("You already have a topic with that name — merge them instead.");
  ok(r);
}
export async function mergeTopics(sourceId: string, targetId: string) {
  ok(await supabase.rpc("merge_topics", { source_id: sourceId, target_id: targetId }));
}
export async function deleteTopic(id: string) {
  ok(await supabase.from("topics").delete().eq("id", id)); // joins cascade; entries untouched
}
export async function unlinkTopic(entryId: string, topicId: string) {
  ok(await supabase.from("entry_topics").delete().eq("entry_id", entryId).eq("topic_id", topicId));
}

// ---------- People ----------
export async function fetchPeople() {
  const people = ok(await supabase.from("people").select("id, name, relationship, notes").order("name"));
  const links = ok(await supabase.from("entry_people").select("person_id, journal_entries(completed_at)"));
  return people
    .map((p) => {
      const dates = links.filter((l) => l.person_id === p.id).map((l) => (l.journal_entries as { completed_at: string } | null)?.completed_at).filter(Boolean) as string[];
      return { ...p, count: dates.length, last: dates.sort().at(-1) ?? null };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function fetchPerson(id: string) {
  const person = one(await supabase.from("people").select("id, name, relationship, notes").eq("id", id).maybeSingle());
  if (!person) return null;
  const links = ok(await supabase.from("entry_people").select("entry_id, journal_entries(id, title, summary, completed_at)").eq("person_id", id));
  const entries = (links.map((l) => l.journal_entries).filter(Boolean) as { id: string; title: string; summary: string | null; completed_at: string }[]).sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const ids = entries.map((e) => e.id);
  const tl = ids.length ? ok(await supabase.from("entry_topics").select("topics(name)").in("entry_id", ids)) : [];
  const counts = new Map<string, number>();
  for (const r of tl) {
    const n = (r.topics as { name: string } | null)?.name;
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const topics = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);
  return { person, entries, topics };
}

export async function updatePerson(id: string, v: { name: string; relationship: string | null; notes: string | null }) {
  const name = v.name.trim().slice(0, 60);
  ok(await supabase.from("people").update({ name, name_key: name.toLowerCase(), relationship: v.relationship?.trim() || null, notes: v.notes?.trim() || null, updated_at: new Date().toISOString() }).eq("id", id));
}
export async function mergePeople(sourceId: string, targetId: string) {
  ok(await supabase.rpc("merge_people", { source_id: sourceId, target_id: targetId }));
}
export async function deletePerson(id: string) {
  ok(await supabase.from("people").delete().eq("id", id));
}

// ---------- Mood ----------
export async function fetchMoods() {
  return ok(await supabase.from("mood_entries").select("id, score, label, note, recorded_at, journal_entry_id, journal_entries(title)").order("recorded_at", { ascending: false }).limit(90));
}
export async function saveMood(v: { score: number; label: string; journal_entry_id?: string | null; note?: string | null }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("auth");
  if (v.journal_entry_id) {
    // One mood per entry: replace any earlier one.
    await supabase.from("mood_entries").delete().eq("journal_entry_id", v.journal_entry_id);
    await supabase.from("journal_entries").update({ mood_score: v.score }).eq("id", v.journal_entry_id);
  }
  ok(await supabase.from("mood_entries").insert({ user_id: u.user.id, score: v.score, label: v.label, journal_entry_id: v.journal_entry_id ?? null, note: v.note ?? null }));
}

// ---------- Entry tags ----------
export async function fetchEntryTags(entryId: string) {
  const [t, p, m] = await Promise.all([
    supabase.from("entry_topics").select("topics(id, name)").eq("entry_id", entryId).then(ok),
    supabase.from("entry_people").select("people(id, name)").eq("entry_id", entryId).then(ok),
    supabase.from("mood_entries").select("score, label").eq("journal_entry_id", entryId).maybeSingle().then(one),
  ]);
  const goals = ok(await supabase.from("goals").select("id, title").eq("created_from_entry_id", entryId));
  return {
    topics: t.map((r) => r.topics).filter(Boolean) as { id: string; name: string }[],
    people: p.map((r) => r.people).filter(Boolean) as { id: string; name: string }[],
    mood: m,
    goals,
  };
}
