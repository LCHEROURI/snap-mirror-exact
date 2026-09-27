import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateObject } = vi.hoisted(() => ({ generateObject: vi.fn(async () => ({})) })); // invalid output -> analysis fails safely
vi.mock("./gateway.server", () => ({
  AiError: class extends Error {},
  generateObject: (...a: unknown[]) => generateObject(...(a as [])),
  generateReply: vi.fn(),
}));
vi.mock("./memory.server", () => ({
  retrieveMemories: vi.fn(),
  saveEntryMemories: vi.fn(),
  retryPendingEmbeddings: vi.fn(),
}));
vi.mock("./ask.server", () => ({ embedEntrySummary: vi.fn() }));
vi.mock("./tags.server", () => ({ linkEntryTags: vi.fn() }));

const { finishSession } = await import("./journal-ai.server");

/** Minimal chainable stand-in for the database client; records inserts. */
function fakeDb() {
  const inserts: string[] = [];
  let entryReads = 0;
  const results: Record<string, unknown> = {
    journal_sessions: {
      id: "s1",
      status: "active",
      session_type: "text",
      started_at: "2026-01-01T00:00:00Z",
      rolling_summary: null,
      rolling_summary_count: 0,
    },
    journal_messages: [
      { id: "m1", role: "user", content: "Hello there", created_at: "2026-01-01T00:00:00Z" },
    ],
  };
  const db = {
    inserts,
    from(table: string) {
      let mode: "select" | "insert" | "update" = "select";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- chainable test double
      const b: any = {
        select: () => b,
        eq: () => b,
        order: () => b,
        insert: () => {
          mode = "insert";
          inserts.push(table);
          return b;
        },
        update: () => {
          mode = "update";
          return b;
        },
        maybeSingle: async () => ({
          data:
            table === "journal_entries"
              ? mode === "select" && entryReads++ === 0
                ? null
                : { id: "e1", session_id: "s1", title: "t", user_id: "u1" }
              : results[table],
          error: null,
        }),
        single: async () => ({ data: { id: "e1" }, error: null }),
        then: (r: (v: unknown) => void) => r({ data: results[table] ?? null, error: null }),
      };
      return b;
    },
  };
  return db;
}

describe("finishSession and the analysis quota", () => {
  beforeEach(() => generateObject.mockClear());

  it("saves the entry and skips analysis when the quota is exhausted", async () => {
    const db = fakeDb();
    const r = await finishSession(
      db as unknown as Parameters<typeof finishSession>[0],
      "u1",
      "s1",
      async () => false,
    );
    expect(db.inserts).toContain("journal_entries");
    expect(r).toEqual({ entryId: "e1", analysisOk: false, analysisDeferred: true });
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("runs analysis when the quota allows it", async () => {
    const db = fakeDb();
    const r = await finishSession(
      db as unknown as Parameters<typeof finishSession>[0],
      "u1",
      "s1",
      async () => true,
    );
    expect(db.inserts).toContain("journal_entries");
    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(r.analysisDeferred).toBe(false);
  });
});
