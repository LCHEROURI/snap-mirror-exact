import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { backfillTags } from "./ai/tags.server";

export const syncTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      return { linked: await backfillTags(context.supabase, context.userId) };
    } catch {
      return { linked: 0 };
    }
  });
