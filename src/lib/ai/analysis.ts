import { z } from "zod";

// Wire schema sent to the model: flat, all required, no bounds (limits are in the prompt).
export const analysisWireSchema = z.object({
  title: z.string(),
  summary: z.string(),
  narrative: z.string(),
  topics: z.array(z.string()),
  people: z.array(z.string()),
  emotions: z.array(z.string()),
  decisions: z.array(z.string()),
  wins: z.array(z.string()),
  concerns: z.array(z.string()),
  memory_candidates: z.array(
    z.object({ type: z.string(), content: z.string(), importance: z.number(), confidence: z.number() }),
  ),
  goal_candidates: z.array(z.object({ title: z.string(), description: z.string(), next_action: z.string() })),
});

export type JournalAnalysis = z.infer<typeof analysisWireSchema>;

const MEMORY_TYPES = new Set([
  "person", "goal", "preference", "event", "decision", "concern",
  "achievement", "project", "relationship", "habit", "belief", "other",
]);

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (a: string[], n: number, max = 80) =>
  [...new Set(a.map((s) => clean(s, max)).filter(Boolean))].slice(0, n);
const unit = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n > 1 ? n / 10 : n)) : 0);

/** Strict server-side validation + normalization. Throws on anything unusable. */
export function validateAnalysis(raw: unknown): JournalAnalysis {
  const a = analysisWireSchema.parse(raw);
  const title = clean(a.title, 120);
  const summary = clean(a.summary, 600);
  if (!title || !summary) throw new Error("Analysis missing title or summary");
  return {
    title,
    summary,
    narrative: clean(a.narrative, 2000),
    topics: list(a.topics, 5, 40),
    people: list(a.people, 10, 60),
    emotions: list(a.emotions, 5, 40),
    decisions: list(a.decisions, 8, 200),
    wins: list(a.wins, 8, 200),
    concerns: list(a.concerns, 8, 200),
    memory_candidates: a.memory_candidates
      .map((m) => ({
        type: MEMORY_TYPES.has(m.type) ? m.type : "other",
        content: clean(m.content, 300),
        importance: unit(m.importance),
        confidence: unit(m.confidence),
      }))
      .filter((m) => m.content)
      .slice(0, 5),
    goal_candidates: a.goal_candidates
      .map((g) => ({ title: clean(g.title, 120), description: clean(g.description, 400), next_action: clean(g.next_action, 200) }))
      .filter((g) => g.title)
      .slice(0, 3),
  };
}
