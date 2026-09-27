import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { editMemory, retryPendingEmbeddings } from "./ai/memory.server";

export const updateMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), content: z.string().min(3).max(600) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    try {
      return { ok: true as const, ...(await editMemory(context.supabase, data.id, data.content)) };
    } catch {
      return { ok: false as const, error: "Couldn't update this memory. Please try again." };
    }
  });

export const retryMemoryEmbeddings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ retried: await retryPendingEmbeddings(context.supabase) }));
