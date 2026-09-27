// Pure date-range interpretation for Ask My Journal, in the user's own timezone. No I/O.
import { addDays, localDate, mondayOf, safeTimezone } from "./weekly";

/** Offset (ms) of `tz` from UTC at instant `t`. */
function tzOffset(t: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!) - Math.floor(t / 1000) * 1000;
}

/** The instant of local midnight at the start of `date` (YYYY-MM-DD) in `tz`, DST-safe. */
export function zonedMidnight(date: string, tz: string): Date {
  const zone = safeTimezone(tz);
  const guess = Date.parse(`${date}T00:00:00Z`);
  let t = guess - tzOffset(guess, zone);
  t = guess - tzOffset(t, zone);
  return new Date(t);
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const firstOf = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

/** Returns undefined when the question has no date phrase. Boundaries are local midnights in `tz`. */
export function parseRange(q: string, tz: string | null | undefined, now = new Date()): { from: Date; to: Date; label: string } | undefined {
  const zone = safeTimezone(tz);
  const s = q.toLowerCase();
  const today = localDate(now, zone);
  const at = (d: string) => zonedMidnight(d, zone);
  const tomorrow = at(addDays(today, 1));
  const [y, mo] = today.split("-").map(Number) as [number, number];
  const m = s.match(/(?:past|last)\s+(\d{1,3})\s+days?/);
  if (m) return { from: at(addDays(today, 1 - Number(m[1]))), to: tomorrow, label: `past ${m[1]} days` };
  if (/\btoday\b/.test(s)) return { from: at(today), to: tomorrow, label: "today" };
  if (/\bthis week\b/.test(s)) return { from: at(mondayOf(today)), to: tomorrow, label: "this week" };
  if (/\blast week\b/.test(s)) {
    const mon = mondayOf(today);
    return { from: at(addDays(mon, -7)), to: at(mon), label: "last week" };
  }
  if (/\bthis month\b/.test(s)) return { from: at(firstOf(y, mo - 1)), to: tomorrow, label: "this month" };
  if (/\blast month\b/.test(s)) return { from: at(firstOf(y, mo - 2)), to: at(firstOf(y, mo - 1)), label: "last month" };
  if (/\b(recently|lately)\b/.test(s)) return { from: at(addDays(today, -29)), to: tomorrow, label: "the past 30 days" };
  const mi = MONTHS.findIndex((mn) => new RegExp(`\\b(in|during)\\s+${mn}\\b`).test(s));
  if (mi >= 0) {
    const yr = mi > mo - 1 ? y - 1 : y;
    return { from: at(firstOf(yr, mi)), to: at(firstOf(yr, mi + 1)), label: MONTHS[mi]! };
  }
  return undefined;
}
