import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RATE_LIMITED, allowAi } from "./ai/rate-limit.server";
import {
  JournalError,
  analyzeEntry,
  finishSession,
  retryReply,
  sendMessage,
} from "./ai/journal-ai.server";

// Errors are returned as values so the UI always gets a safe, readable message.
type Fail = { ok: false; code: string; error: string };
function fail(e: unknown): Fail {
  if (e instanceof JournalError) return { ok: false, code: e.code, error: e.message };
  console.error("[journal] unexpected", (e as Error)?.name);
  return { ok: false, code: "unknown", error: "Something went wrong. Please try again." };
}

export const sendJournalMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ sessionId: z.string().uuid(), message: z.string().min(1).max(8000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      if (!(await allowAi(context.supabase, "chat"))) return RATE_LIMITED;
      return {
        ok: true as const,
        ...(await sendMessage(context.supabase, context.userId, data.sessionId, data.message)),
      };
    } catch (e) {
      return fail(e);
    }
  });

export const retryJournalReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      if (!(await allowAi(context.supabase, "chat"))) return RATE_LIMITED;
      return {
        ok: true as const,
        ...(await retryReply(context.supabase, context.userId, data.sessionId)),
      };
    } catch (e) {
      return fail(e);
    }
  });

export const finishJournalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      // Saving is never limited; only the AI analysis step obeys the analysis quota.
      return {
        ok: true as const,
        ...(await finishSession(context.supabase, context.userId, data.sessionId, () =>
          allowAi(context.supabase, "analysis"),
        )),
      };
    } catch (e) {
      return fail(e);
    }
  });

export const retryEntryAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      if (!(await allowAi(context.supabase, "analysis"))) return RATE_LIMITED;
      const r = await analyzeEntry(context.supabase, data.entryId);
      return { ok: true as const, analysisOk: r.ok };
    } catch (e) {
      return fail(e);
    }
  });
