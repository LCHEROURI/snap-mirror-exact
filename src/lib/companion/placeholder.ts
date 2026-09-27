import { PLACEHOLDER_PREFIX, type ReflectionCompanion } from "./types";

// DEVELOPMENT ONLY. Deterministic, non-AI responses used to verify the journal
// flow before Phase 3 connects a real model. Never presented as AI.
const PROMPTS = [
  "Thanks for writing that down. What feels most important about it right now?",
  "Noted. Is there a part of this you'd like to stay with a little longer?",
  "Got it. What would you want to remember about today when you look back?",
  "Thank you. Is there anything underneath this you haven't said yet?",
];

export const placeholderCompanion: ReflectionCompanion = {
  async reply(recent) {
    const userTurns = recent.filter((t) => t.role === "user").length;
    return {
      provider: "placeholder",
      content: PLACEHOLDER_PREFIX + PROMPTS[(userTurns - 1 + PROMPTS.length) % PROMPTS.length],
    };
  },
};
