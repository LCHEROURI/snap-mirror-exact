import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, NoObjectGeneratedError, streamText, type ModelMessage, Output } from "ai";
import type { z } from "zod";
import { aiConfig } from "./config.server";

const RUN_ID = "X-Lovable-AIG-Run-ID";

function provider() {
  const cfg = aiConfig();
  let runId: string | undefined;
  const p = createOpenAI({
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey,
    headers: { "Lovable-API-Key": cfg.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN_ID)) headers.set(RUN_ID, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN_ID)?.trim() || undefined;
      return res;
    },
  });
  return { p, cfg };
}

const openaiOptions = (reasoning: "low" | "medium") => ({
  openai: {
    forceReasoning: true,
    reasoningEffort: reasoning,
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
});

/** Safe, user-facing error. Never includes provider details or journal text. */
export class AiError extends Error {
  constructor(public code: "credits" | "rate_limit" | "provider" | "malformed", message: string) {
    super(message);
  }
}

function mapError(e: unknown): never {
  const status = APICallError.isInstance(e) ? e.statusCode : undefined;
  console.error("[ai] call failed", { status, name: (e as Error)?.name });
  if (status === 402) throw new AiError("credits", "AI credits have run out for this workspace. Please try again later.");
  if (status === 429) throw new AiError("rate_limit", "The companion is busy right now. Please wait a moment and try again.");
  throw new AiError("provider", "The companion couldn't respond just now. Please try again.");
}

export async function generateReply(system: string, messages: ModelMessage[], model: "chat" | "analysis" = "chat") {
  const { p, cfg } = provider();
  try {
    const result = streamText({
      model: p.responses(model === "chat" ? cfg.chatModel : cfg.analysisModel),
      system,
      messages,
      providerOptions: openaiOptions("low"),
    });
    const text = (await result.text).trim();
    if (!text) throw new AiError("provider", "The companion couldn't respond just now. Please try again.");
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    mapError(e);
  }
}

export async function generateObject<T>(system: string, prompt: string, schema: z.ZodType<T>) {
  const { p, cfg } = provider();
  try {
    const result = streamText({
      model: p.responses(cfg.analysisModel),
      system,
      prompt,
      output: Output.object({ schema }),
      providerOptions: openaiOptions("low"),
    });
    return (await result.output) as T;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) {
      console.error("[ai] malformed structured output");
      throw new AiError("malformed", "The analysis came back in an unexpected format.");
    }
    if (e instanceof AiError) throw e;
    mapError(e);
  }
}
