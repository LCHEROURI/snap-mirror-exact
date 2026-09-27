import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RATE_LIMITED, allowAi } from "./ai/rate-limit.server";
import { AskError, askJournal } from "./ai/ask.server";

// ask-journal: identity comes only from the session; errors are returned as safe values.
export const askMyJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      if (!(await allowAi(context.supabase, "ask"))) return RATE_LIMITED;
      return { ok: true as const, ...(await askJournal(context.supabase, context.userId, data.question)) };
    } catch (e) {
      if (e instanceof AskError) return { ok: false as const, code: e.code, error: e.message };
      console.error("[ask] unexpected", (e as Error)?.name);
      return { ok: false as const, code: "unknown", error: "Something went wrong. Please try again." };
    }
  });
