// Pure week math + weekly report validation. Shared by server and browser; no I/O here.
import { z } from "zod";

export const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

export function safeTimezone(tz: string | null | undefined) {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Calendar date (YYYY-MM-DD) of an instant in a timezone. */
export function localDate(when: string | number | Date, tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(when));
}

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function mondayOf(date: string) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

export const currentWeekStart = (tz: string, now: number = Date.now()) =>
  mondayOf(localDate(now, tz));

export function weekLabel(start: string) {
  const f = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return `${f(start)} – ${f(addDays(start, 6))}`;
}

// ---- AI output ----
// Wire schema: flat, all required. Model cites entries as E1..En and goals as G1..Gn; server maps refs.
export const weeklyWireSchema = z.object({
  summary: z.string(),
  themes: z.array(z.object({ title: z.string(), description: z.string() })),
  wins: z.array(z.string()),
  challenges: z.array(z.string()),
  patterns: z.array(z.object({ observation: z.string(), evidence_refs: z.array(z.string()) })),
  decisions: z.array(z.string()),
  goal_progress: z.array(z.object({ goal_ref: z.string(), summary: z.string() })),
  worth_noticing: z.string(),
  next_week: z.array(z.string()),
});

export type WeeklyReport = {
  summary: string;
  themes: { title: string; description: string }[];
  wins: string[];
  challenges: string[];
  patterns: { observation: string; evidence_count: number }[];
  decisions: string[];
  goal_progress: { goal_id: string | null; goal_title: string; summary: string }[];
  worth_noticing: string | null;
  next_week: string[];
};

const clean = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "";
const list = (a: string[], n: number, max = 220) =>
  [...new Set(a.map((s) => clean(s, max)).filter(Boolean))].slice(0, n);

// Phrases the report must never contain (deterministic or diagnostic framing).
const BANNED =
  /\b(you always|you never|you are clearly|you suffer|this proves|you should definitely|diagnos|disorder|depress(ed|ion)|anxiety disorder)\b/i;
const safe = (s: string) => (BANNED.test(s) ? "" : s);

/**
 * Strict validation. Throws on unusable output. Pattern evidence counts are computed from
 * refs that actually exist (never the model's own number); goals only map to provided ids.
 */
export function validateWeekly(
  raw: unknown,
  entryRefs: Set<string>,
  goals: Map<string, { id: string; title: string }>,
): WeeklyReport {
  const a = weeklyWireSchema.parse(raw);
  const summary = safe(clean(a.summary, 700));
  if (!summary) throw new Error("Weekly report missing summary");
  const patterns = a.patterns
    .map((p) => ({
      observation: safe(clean(p.observation, 260)),
      evidence_count: new Set(
        p.evidence_refs.map((r) => r.trim().toUpperCase()).filter((r) => entryRefs.has(r)),
      ).size,
    }))
    .filter((p) => p.observation && p.evidence_count >= 2) // "recurring" needs at least two entries
    .slice(0, 4);
  const goal_progress = a.goal_progress
    .map((g) => {
      const goal = goals.get(g.goal_ref.trim().toUpperCase());
      return goal
        ? { goal_id: goal.id, goal_title: goal.title, summary: safe(clean(g.summary, 260)) }
        : null;
    })
    .filter((g): g is NonNullable<typeof g> => !!g && !!g.summary)
    .filter((g, i, arr) => arr.findIndex((x) => x.goal_id === g.goal_id) === i)
    .slice(0, 6);
  return {
    summary,
    themes: a.themes
      .map((t) => ({ title: clean(t.title, 60), description: safe(clean(t.description, 240)) }))
      .filter((t) => t.title && t.description)
      .slice(0, 4),
    wins: list(a.wins, 5).map(safe).filter(Boolean),
    challenges: list(a.challenges, 5).map(safe).filter(Boolean),
    patterns,
    decisions: list(a.decisions, 5).map(safe).filter(Boolean),
    goal_progress,
    worth_noticing: entryRefs.size >= 2 ? safe(clean(a.worth_noticing, 300)) || null : null,
    next_week: list(a.next_week, 4, 200).map(safe).filter(Boolean),
  };
}
