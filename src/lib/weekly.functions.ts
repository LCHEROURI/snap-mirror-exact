import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RATE_LIMITED, allowAi } from "./ai/rate-limit.server";
import { WEEK_RE } from "./weekly";
import { WeeklyError, generateWeeklyReport } from "./ai/weekly.server";

// Stands in for the spec's generate-weekly-report Edge Function. Identity comes from the session only.
export const generateWeekly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        week_start: z.string().regex(WEEK_RE).optional(),
        regenerate: z.boolean().optional(),
        timezone: z.string().max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      if (!(await allowAi(context.supabase, "weekly"))) return RATE_LIMITED;
      const r = await generateWeeklyReport(context.supabase, context.userId, {
        weekStart: data.week_start,
        regenerate: data.regenerate,
        timezone: data.timezone,
      });
      return {
        ok: true as const,
        status: r.status,
        id: r.report.id,
        week_start: r.report.week_start,
      };
    } catch (e) {
      if (e instanceof WeeklyError) return { ok: false as const, code: e.code, error: e.message };
      console.error("[weekly] unexpected", (e as Error)?.name);
      return {
        ok: false as const,
        code: "unknown",
        error: "Something went wrong. Please try again.",
      };
    }
  });
