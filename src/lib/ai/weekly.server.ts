// Weekly reflection synthesis. Loads only the caller's week (RLS client), builds a compact evidence
// set from stored summaries/analysis (never transcripts), makes one AI call, validates, upserts.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { aiConfig } from "./config.server";
import { AiError, generateObject } from "./gateway.server";
import {
  addDays,
  currentWeekStart,
  localDate,
  mondayOf,
  safeTimezone,
  validateWeekly,
  weeklyWireSchema,
} from "../weekly";

type Db = SupabaseClient<Database>;

export class WeeklyError extends Error {
  constructor(
    public code: "invalid" | "future" | "insufficient" | "db" | "rate_limit" | "ai",
    message: string,
  ) {
    super(message);
  }
}

const SYSTEM = `You write a short weekly reflection for a private journal app. You are not a therapist or clinician.
Use ONLY the evidence given. Never invent events, people, feelings or progress.
Tone: observational and grounded. Prefer "You mentioned…", "A recurring theme this week was…", "Several entries focused on…", "You returned to…".
Never write "you always", "you never", "you are clearly", "you suffer from", "this proves", "you should definitely". No diagnosis, no medical or psychological labels, no motives stated as fact.
Keep every item to one or two sentences. Empty arrays are fine when evidence is thin.
- summary: 2-3 sentences about the week.
- themes: up to 4 {title, description}.
- wins, challenges, decisions: short items drawn from the evidence.
- patterns: things that appeared in at least two different entries; list the entry refs (E1, E2…) in evidence_refs.
- goal_progress: only for listed goals (use their G ref) that have real evidence this week.
- worth_noticing: one restrained, evidence-based observation, or "" if evidence is weak.
- next_week: up to 3 gentle, optional suggestions the user could consider.`;

export async function ensureTimezone(db: Db, userId: string, browserTz?: string | undefined) {
  const { data } = await db.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  if (data?.timezone) return safeTimezone(data.timezone);
  const tz = safeTimezone(browserTz);
  if (browserTz && tz === browserTz)
    await db.from("profiles").update({ timezone: tz }).eq("id", userId);
  return tz;
}

type Opts = {
  weekStart?: string | undefined;
  regenerate?: boolean | undefined;
  timezone?: string | undefined;
};

export async function generateWeeklyReport(db: Db, userId: string, opts: Opts) {
  const tz = await ensureTimezone(db, userId, opts.timezone);
  const current = currentWeekStart(tz);
  const ws = opts.weekStart ?? current;
  if (mondayOf(ws) !== ws) throw new WeeklyError("invalid", "Weeks start on Monday.");
  if (ws > current) throw new WeeklyError("future", "That week hasn't happened yet.");
  const we = addDays(ws, 6);

  const existing = await db.from("weekly_reports").select("*").eq("week_start", ws).maybeSingle();
  if (existing.error) throw new WeeklyError("db", "Couldn't check for an existing reflection.");
  if (existing.data && !opts.regenerate)
    return { status: "exists" as const, report: existing.data };
  if (existing.data && Date.now() - +new Date(existing.data.updated_at) < 30_000)
    throw new WeeklyError(
      "rate_limit",
      "This reflection was just generated. Please wait a moment before regenerating.",
    );

  // Query a padded UTC window, then keep rows whose local date falls inside the week.
  const from = `${addDays(ws, -1)}T00:00:00Z`;
  const to = `${addDays(we, 2)}T00:00:00Z`;
  const inWeek = (iso: string) => {
    const d = localDate(iso, tz);
    return d >= ws && d <= we;
  };

  const [entriesR, goalsR, checkinsR, moodsR] = await Promise.all([
    db
      .from("journal_entries")
      .select("id, title, summary, analysis, completed_at")
      .gte("completed_at", from)
      .lt("completed_at", to)
      .order("completed_at")
      .limit(60),
    db
      .from("goals")
      .select("id, title, status, created_at, updated_at")
      .in("status", ["active", "paused", "completed"])
      .order("updated_at", { ascending: false })
      .limit(30),
    db
      .from("goal_checkins")
      .select("goal_id, note, progress, created_at")
      .gte("created_at", from)
      .lt("created_at", to),
    db
      .from("mood_entries")
      .select("score, recorded_at")
      .gte("recorded_at", from)
      .lt("recorded_at", to),
  ]);
  if (entriesR.error || goalsR.error || checkinsR.error || moodsR.error)
    throw new WeeklyError("db", "Couldn't load this week's journal.");

  const entries = entriesR.data.filter((e) => inWeek(e.completed_at) && e.summary).slice(0, 25);
  if (!entries.length)
    throw new WeeklyError(
      "insufficient",
      "There isn't enough journal activity this week for a meaningful weekly reflection yet.",
    );

  const ids = entries.map((e) => e.id);
  const [tl, pl] = await Promise.all([
    db.from("entry_topics").select("entry_id, topics(name)").in("entry_id", ids),
    db.from("entry_people").select("entry_id, people(name)").in("entry_id", ids),
  ]);
  const tagsFor = (
    rows: { entry_id: string; [k: string]: unknown }[] | null,
    key: string,
    id: string,
  ) =>
    (rows ?? [])
      .filter((r) => r.entry_id === id)
      .map((r) => (r[key] as { name: string } | null)?.name)
      .filter(Boolean)
      .join(", ");

  const checkins = checkinsR.data.filter((c) => inWeek(c.created_at));
  const goals = goalsR.data
    .filter(
      (g) =>
        g.status === "active" || checkins.some((c) => c.goal_id === g.id) || inWeek(g.updated_at),
    )
    .slice(0, 8);
  const moods = moodsR.data.filter((m) => inWeek(m.recorded_at));

  const entryRefs = new Set<string>();
  const trim = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");
  const listOf = (a: unknown, n = 3) =>
    Array.isArray(a)
      ? a
          .filter((x) => typeof x === "string")
          .slice(0, n)
          .map((x) => trim(x, 160))
          .join("; ")
      : "";
  const entryLines = entries.map((e, i) => {
    const ref = `E${i + 1}`;
    entryRefs.add(ref);
    const a = (e.analysis ?? {}) as Record<string, unknown>;
    return [
      `${ref} (${localDate(e.completed_at, tz)}): ${trim(e.title, 120)} — ${trim(e.summary, 500)}`,
      listOf(a["wins"]) && `  wins: ${listOf(a["wins"])}`,
      listOf(a["concerns"]) && `  concerns: ${listOf(a["concerns"])}`,
      listOf(a["decisions"]) && `  decisions: ${listOf(a["decisions"])}`,
      tagsFor(tl.data, "topics", e.id) && `  topics: ${tagsFor(tl.data, "topics", e.id)}`,
      tagsFor(pl.data, "people", e.id) && `  people: ${tagsFor(pl.data, "people", e.id)}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
  const goalMap = new Map<string, { id: string; title: string }>();
  const goalLines = goals.map((g, i) => {
    const ref = `G${i + 1}`;
    goalMap.set(ref, { id: g.id, title: g.title });
    const notes = checkins
      .filter((c) => c.goal_id === g.id)
      .slice(0, 3)
      .map((c) => trim(c.note, 140))
      .filter(Boolean);
    return `${ref}: ${trim(g.title, 120)} [${g.status}]${notes.length ? ` — check-ins this week: ${notes.join("; ")}` : " — no check-ins this week"}`;
  });
  const moodLine =
    moods.length >= 2
      ? `Mood check-ins this week: ${moods.length}, average ${(moods.reduce((s, m) => s + m.score, 0) / moods.length).toFixed(1)} on a 1-5 scale.`
      : "Mood: not enough check-ins to mention.";

  const prompt = `Week ${ws} to ${we}.\n\nEntries:\n${entryLines.join("\n")}\n\nGoals:\n${goalLines.join("\n") || "none"}\n\n${moodLine}`;

  let report;
  try {
    const raw = await generateObject(SYSTEM, prompt, weeklyWireSchema, aiConfig().weeklyModel);
    report = validateWeekly(raw, entryRefs, goalMap);
  } catch (e) {
    if (e instanceof AiError)
      throw new WeeklyError(
        "ai",
        e.code === "malformed"
          ? "The reflection came back in an unexpected format. Please try again."
          : e.message,
      );
    console.error("[weekly] invalid output");
    throw new WeeklyError(
      "ai",
      "The reflection came back in an unexpected format. Please try again.",
    );
  }

  const row = {
    user_id: userId,
    week_start: ws,
    week_end: we,
    entry_count: entries.length,
    ...report,
  };
  const saved = await db
    .from("weekly_reports")
    .upsert(row, { onConflict: "user_id,week_start" })
    .select("*")
    .single();
  if (saved.error) throw new WeeklyError("db", "Couldn't save your weekly reflection.");
  return {
    status: existing.data ? ("regenerated" as const) : ("created" as const),
    report: saved.data,
  };
}
