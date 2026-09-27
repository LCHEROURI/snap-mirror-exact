import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { JournalError, sendMessage } from "./ai/journal-ai.server";
import { availableModes, createRealtimeSecret, ownedVoiceSession, saveRealtimeTurn, speakMessage, transcribe } from "./ai/voice.server";

type Fail = { ok: false; code: string; error: string };
function fail(e: unknown): Fail {
  if (e instanceof JournalError) return { ok: false, code: e.code, error: e.message };
  console.error("[voice] unexpected", (e as Error)?.name);
  return { ok: false, code: "unknown", error: "Something went wrong with voice. Your transcript so far is saved." };
}
const sid = z.string().uuid();

/** Which voice paths the server can offer, plus limits. Stands in for part of the spec's realtime-session. */
export const voiceSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: sid }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      await ownedVoiceSession(context.supabase, context.userId, data.sessionId);
      return { ok: true as const, modes: availableModes() };
    } catch (e) {
      return fail(e);
    }
  });

/** realtime-session: short-lived client secret only. */
export const realtimeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: sid }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      return { ok: true as const, ...(await createRealtimeSecret(context.supabase, context.userId, data.sessionId)) };
    } catch (e) {
      return fail(e);
    }
  });

export const realtimeTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: sid, role: z.enum(["user", "assistant"]), text: z.string().max(8000), itemId: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      return { ok: true as const, ...(await saveRealtimeTurn(context.supabase, context.userId, data.sessionId, data.role, data.text, data.itemId)) };
    } catch (e) {
      return fail(e);
    }
  });

/** Turn-based: one recorded turn → transcript → the normal journal-chat reply (same prompt, memory, safety). */
export const voiceTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => {
    if (!(d instanceof FormData)) throw new Error("Expected form data");
    const sessionId = sid.parse(d.get("sessionId"));
    const audio = d.get("audio");
    if (!(audio instanceof File)) throw new Error("Missing audio");
    return { sessionId, audio };
  })
  .handler(async ({ data, context }) => {
    try {
      await ownedVoiceSession(context.supabase, context.userId, data.sessionId);
      const text = await transcribe(data.audio);
      const r = await sendMessage(context.supabase, context.userId, data.sessionId, text);
      return { ok: true as const, userText: r.userMessage.content, assistant: { id: r.assistantMessage.id, content: r.assistantMessage.content }, safety: r.safety };
    } catch (e) {
      return fail(e);
    }
  });

export const voiceSpeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ messageId: sid }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      return { ok: true as const, ...(await speakMessage(context.supabase, data.messageId)) };
    } catch (e) {
      return fail(e);
    }
  });
