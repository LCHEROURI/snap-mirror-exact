// Deterministic helpers shared by server tagging and tests (no AI).

const PREFIX = /^(my|our|the)\s+/i;
const ROLE =
  /^(friend|best friend|colleague|coworker|co-worker|boss|manager|neighbou?r|partner|cousin)\s+(?=[A-Z])/;

/** Conservative display name: "my friend Mike" -> "Mike". Never merges different names (Mike vs Michael). */
export function cleanPersonName(raw: string) {
  let s = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/[.,;:!?]+$/, "");
  s = s.replace(PREFIX, "");
  s = s.replace(ROLE, "");
  return s.slice(0, 60);
}

/** "Priya (manager)" -> "manager" — only what the model wrote, never inferred further. */
export function personRelationship(raw: string) {
  const m = raw.match(/\(([^)]{1,40})\)\s*$/);
  return m ? m[1]!.trim() : null;
}

export const personKey = (raw: string) => cleanPersonName(raw).toLowerCase();

export function cleanTopic(raw: string) {
  const s = raw.replace(/\s+/g, " ").trim().slice(0, 40);
  return s ? s[0]!.toUpperCase() + s.slice(1) : "";
}

export const MOODS = [
  { score: 1, label: "Very low" },
  { score: 2, label: "Low" },
  { score: 3, label: "Neutral" },
  { score: 4, label: "Good" },
  { score: 5, label: "Great" },
] as const;
