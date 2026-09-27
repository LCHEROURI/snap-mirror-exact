import { describe, expect, it } from "vitest";
import { addDays, currentWeekStart, mondayOf, validateWeekly } from "./weekly";

const base = {
  summary: "You mentioned the launch several times.",
  themes: [{ title: "Work", description: "Several entries focused on the launch." }],
  wins: ["Shipped onboarding"],
  challenges: [],
  decisions: [],
  next_week: ["Pick one task each morning"],
  patterns: [
    { observation: "You returned to the launch.", evidence_refs: ["E1", "E2", "E9"] },
    { observation: "Only once.", evidence_refs: ["E1"] },
  ],
  goal_progress: [
    { goal_ref: "G1", summary: "Two check-ins." },
    { goal_ref: "G7", summary: "Invented." },
  ],
  worth_noticing: "Clearer days followed a morning plan.",
};
const refs = new Set(["E1", "E2"]);
const goals = new Map([
  ["G1", { id: "11111111-1111-1111-1111-111111111111", title: "Finish onboarding" }],
]);

describe("week math", () => {
  it("finds Monday", () => {
    expect(mondayOf("2026-09-27")).toBe("2026-09-21"); // Sunday
    expect(mondayOf("2026-09-21")).toBe("2026-09-21");
    expect(addDays("2026-09-21", 6)).toBe("2026-09-27");
  });
  it("respects timezone at the week boundary", () => {
    const t = Date.parse("2026-09-28T02:00:00Z"); // Monday in UTC, still Sunday in New York
    expect(currentWeekStart("UTC", t)).toBe("2026-09-28");
    expect(currentWeekStart("America/New_York", t)).toBe("2026-09-21");
  });
});

describe("validateWeekly", () => {
  it("counts only real evidence and drops single-entry patterns", () => {
    const r = validateWeekly(base, refs, goals);
    expect(r.patterns).toEqual([{ observation: "You returned to the launch.", evidence_count: 2 }]);
  });
  it("only keeps goals the server provided", () => {
    const r = validateWeekly(base, refs, goals);
    expect(r.goal_progress).toHaveLength(1);
    expect(r.goal_progress[0]!.goal_id).toBe("11111111-1111-1111-1111-111111111111");
  });
  it("rejects malformed output", () => {
    expect(() => validateWeekly({ summary: "x" }, refs, goals)).toThrow();
    expect(() => validateWeekly({ ...base, summary: "  " }, refs, goals)).toThrow();
  });
  it("strips diagnostic or absolute phrasing", () => {
    const r = validateWeekly(
      {
        ...base,
        wins: ["You always win", "Finished a draft"],
        challenges: ["You appear depressed"],
      },
      refs,
      goals,
    );
    expect(r.wins).toEqual(["Finished a draft"]);
    expect(r.challenges).toEqual([]);
  });
  it("omits worth-noticing with a single entry", () => {
    expect(validateWeekly(base, new Set(["E1"]), goals).worth_noticing).toBeNull();
  });
});
