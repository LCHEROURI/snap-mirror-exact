// Browser data access for weekly reports and deterministic Insights numbers. RLS scopes every query;
// nothing here calls AI — opening Insights or a report never triggers generation.
import { supabase } from "@/integrations/supabase/client";
import { addDays, currentWeekStart, localDate, safeTimezone } from "./weekly";
import type { WeeklyReport } from "./weekly";

function ok<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw r.error;
  return (r.data ?? []) as NonNullable<T>;
}

export type ReportRow = WeeklyReport & { id: string; week_start: string; week_end: string | null; entry_count: number; created_at: string; updated_at: string };

const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export async function fetchTimezone() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return safeTimezone(browserTz());
  const { data } = await supabase.from("profiles").select("timezone").eq("id", u.user.id).maybeSingle();
  return safeTimezone(data?.timezone ?? browserTz());
}

export async function fetchReports() {
  return ok(await supabase.from("weekly_reports").select("id, week_start, week_end, summary, themes, entry_count, updated_at").not("summary", "is", null).order("week_start", { ascending: false }).limit(52)) as unknown as Pick<ReportRow, "id" | "week_start" | "week_end" | "summary" | "themes" | "entry_count" | "updated_at">[];
}

export async function fetchReport(weekStart: string) {
  const r = await supabase.from("weekly_reports").select("*").eq("week_start", weekStart).not("summary", "is", null).maybeSingle();
  if (r.error) throw r.error;
  return r.data as unknown as ReportRow | null;
}

export async function deleteReport(id: string) {
  ok(await supabase.from("weekly_reports").delete().eq("id", id));
}

/** All counts are plain database reads filtered to the week in the user's timezone. */
export async function fetchInsights() {
  const tz = await fetchTimezone();
  const ws = currentWeekStart(tz);
  const we = addDays(ws, 6);
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const pad = `${addDays(ws, -1)}T00:00:00Z`;
  const inWeek = (iso: string) => { const d = localDate(iso, tz); return d >= ws && d <= we; };

  const [entries, sessions, goals, checkins, moods, topicLinks, peopleLinks, reports] = await Promise.all([
    supabase.from("journal_entries").select("id, completed_at").gte("completed_at", since30 < pad ? since30 : pad).then(ok),
    supabase.from("journal_sessions").select("id, ended_at").eq("status", "completed").gte("ended_at", pad).then(ok),
    supabase.from("goals").select("id, title, status, updated_at").then(ok),
    supabase.from("goal_checkins").select("id, goal_id, note, created_at").order("created_at", { ascending: false }).limit(50).then(ok),
    supabase.from("mood_entries").select("score, recorded_at").gte("recorded_at", since30).order("recorded_at").then(ok),
    supabase.from("entry_topics").select("entry_id, topic_id, topics(name)").then(ok),
    supabase.from("entry_people").select("entry_id, person_id, people(name)").then(ok),
    supabase.from("weekly_reports").select("id, week_start, summary, themes, patterns").not("summary", "is", null).order("week_start", { ascending: false }).limit(4).then(ok),
  ]);

  const weekEntryIds = new Set(entries.filter((e) => inWeek(e.completed_at)).map((e) => e.id));
  const monthEntryIds = new Set(entries.filter((e) => e.completed_at >= since30).map((e) => e.id));
  const weekCheckins = checkins.filter((c) => inWeek(c.created_at));
  const touched = new Set([...weekCheckins.map((c) => c.goal_id), ...goals.filter((g) => g.status === "active" && inWeek(g.updated_at)).map((g) => g.id)]);

  const countBy = <T,>(rows: T[], keep: (r: T) => boolean, id: (r: T) => string, name: (r: T) => string | undefined) => {
    const m = new Map<string, { id: string; name: string; count: number }>();
    for (const r of rows) {
      const n = name(r);
      if (!keep(r) || !n) continue;
      const k = id(r);
      m.set(k, { id: k, name: n, count: (m.get(k)?.count ?? 0) + 1 });
    }
    return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };
  const tName = (r: (typeof topicLinks)[number]) => (r.topics as { name: string } | null)?.name;
  const weekTopics = countBy(topicLinks, (r) => weekEntryIds.has(r.entry_id), (r) => r.topic_id, tName);
  const monthTopics = countBy(topicLinks, (r) => monthEntryIds.has(r.entry_id), (r) => r.topic_id, tName);
  const people = countBy(peopleLinks, () => true, (r) => r.person_id, (r) => (r.people as { name: string } | null)?.name);

  const weekMoods = moods.filter((m) => inWeek(m.recorded_at));
  // Daily average series for the last 30 days (only days with a check-in).
  const byDay = new Map<string, number[]>();
  for (const m of moods) {
    const d = localDate(m.recorded_at, tz);
    byDay.set(d, [...(byDay.get(d) ?? []), m.score]);
  }
  const moodSeries = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, s]) => ({ date, score: s.reduce((x, y) => x + y, 0) / s.length }));

  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));
  return {
    weekStart: ws,
    thisWeek: {
      entries: weekEntryIds.size,
      reflections: sessions.filter((s) => s.ended_at && inWeek(s.ended_at)).length,
      goalsTouched: touched.size,
      topTopics: weekTopics.slice(0, 3),
      mood: weekMoods.length >= 2 ? { count: weekMoods.length, avg: weekMoods.reduce((s, m) => s + m.score, 0) / weekMoods.length } : null,
    },
    moodSeries,
    topics: monthTopics.slice(0, 5),
    people: people.slice(0, 5),
    goals: {
      active: goals.filter((g) => g.status === "active").length,
      completed: goals.filter((g) => g.status === "completed").length,
      recentCheckins: checkins.slice(0, 3).map((c) => ({ ...c, goalTitle: goalTitle.get(c.goal_id) ?? "Goal" })),
    },
    patterns: reports.flatMap((r) => ((r.patterns as WeeklyReport["patterns"]) ?? []).map((p) => ({ ...p, week_start: r.week_start }))).slice(0, 4),
    reports: reports.slice(0, 3).map((r) => ({ id: r.id, week_start: r.week_start, summary: r.summary, themes: (r.themes as WeeklyReport["themes"]) ?? [] })),
  };
}
