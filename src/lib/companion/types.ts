// Service boundary for the reflection companion.
// Phase 2 ships only a clearly labelled development placeholder.
// Phase 3 replaces the provider behind `generateCompanionReply` with a real AI model.

export type CompanionProvider = "placeholder" | "ai";

export interface CompanionTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CompanionReply {
  content: string;
  provider: CompanionProvider;
}

export interface ReflectionCompanion {
  reply(recent: CompanionTurn[]): Promise<CompanionReply>;
}

/** Marker prefix stored on placeholder messages so they are never mistaken for real AI output. */
export const PLACEHOLDER_PREFIX = "[placeholder] ";
