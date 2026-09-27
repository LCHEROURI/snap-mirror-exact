// Isolated safety layer. Runs before any ordinary reflection reply.
// Deliberately conservative pattern check for statements of imminent intent to harm self or others.
const PATTERNS: RegExp[] = [
  /\b(kill|end|hurt|harm)\s+(myself|my\s*self|my\s+life)\b/i,
  /\b(want|going|plan(ning)?|about)\s+to\s+(die|kill\s+myself|end\s+it(\s+all)?)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive)\b/i,
  /\b(going|plan(ning)?|about|want)\s+to\s+(kill|hurt|shoot|stab)\s+(him|her|them|someone|somebody|my\s+\w+)\b/i,
];

export function needsSafetyResponse(text: string) {
  return PATTERNS.some((p) => p.test(text));
}

export const SAFETY_RESPONSE =
  "I'm really glad you told me. What you're describing sounds serious, and you deserve support from a real person right now. " +
  "If you might act on this or you're in immediate danger, please call your local emergency number (for example 911 in the US, 999 in the UK, 112 in the EU). " +
  "You can also reach a crisis line — in the US, call or text 988; elsewhere, findahelpline.com lists free, confidential lines in your country. " +
  "If you can, reach out to someone you trust and let them know how you're feeling. I'm a journaling companion, not a crisis service, but I'm here when you want to write again.";
