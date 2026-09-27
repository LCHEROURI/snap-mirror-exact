import { describe, expect, it } from "vitest";
import { parseRange, zonedMidnight } from "./ask-range";

const iso = (d?: Date) => d?.toISOString();

describe("Ask My Journal date ranges use the user's timezone", () => {
  it("Tokyo: late UTC evening is already the next local day", () => {
    const now = new Date("2026-03-10T20:00:00Z"); // 05:00 on 11 Mar in Tokyo
    const r = parseRange("what happened today", "Asia/Tokyo", now)!;
    expect(iso(r.from)).toBe("2026-03-10T15:00:00.000Z");
    expect(iso(r.to)).toBe("2026-03-11T15:00:00.000Z");
    const w = parseRange("this week", "Asia/Tokyo", now)!; // Wed 11 Mar -> Mon 9 Mar
    expect(iso(w.from)).toBe("2026-03-08T15:00:00.000Z");
  });

  it("New York across the spring DST change", () => {
    const now = new Date("2026-03-09T12:00:00Z"); // Mon 9 Mar, EDT began 8 Mar
    const r = parseRange("last week", "America/New_York", now)!;
    expect(iso(r.from)).toBe("2026-03-02T05:00:00.000Z"); // EST
    expect(iso(r.to)).toBe("2026-03-09T04:00:00.000Z"); // EDT
    expect(iso(zonedMidnight("2026-11-02", "America/New_York"))).toBe("2026-11-02T05:00:00.000Z");
  });

  it("last month in January rolls back the year", () => {
    const r = parseRange("last month", "UTC", new Date("2026-01-15T12:00:00Z"))!;
    expect(iso(r.from)).toBe("2025-12-01T00:00:00.000Z");
    expect(iso(r.to)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("invalid or empty timezones fall back to UTC", () => {
    const now = new Date("2026-05-05T10:00:00Z");
    for (const tz of ["Not/AZone", "", null])
      expect(iso(parseRange("today", tz, now)!.from)).toBe("2026-05-05T00:00:00.000Z");
  });

  it("no date phrase gives no range", () => {
    expect(parseRange("what stresses me", "Asia/Tokyo")).toBeUndefined();
  });
});
