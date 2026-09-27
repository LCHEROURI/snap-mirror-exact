import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditLog, buildExport, runDelete } from "./privacy.server";

// Typed phrase the user must enter for each destructive action; checked on the server, not just in the UI.
export const CONFIRM_PHRASES = {
  history: "DELETE",
  memories: "DELETE",
  all_data: "DELETE",
  account: "DELETE",
} as const;

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const email = (context.claims as { email?: string }).email;
      const r = await buildExport(context.supabase, context.userId, email);
      auditLog("export", context.userId, true);
      return { ok: true as const, ...r };
    } catch {
      auditLog("export", context.userId, false);
      return {
        ok: false as const,
        error: "Your export couldn't be prepared. Nothing was changed — please try again.",
      };
    }
  });

export const deleteMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ scope: z.enum(["history", "memories", "all_data"]), confirm: z.string().max(20) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.confirm !== CONFIRM_PHRASES[data.scope])
      return { ok: false as const, error: "Type DELETE to confirm." };
    try {
      await runDelete(context.supabase, data.scope);
      auditLog(`delete_${data.scope}`, context.userId, true);
      return { ok: true as const };
    } catch {
      auditLog(`delete_${data.scope}`, context.userId, false);
      // Each scope runs as one database transaction, so a failure leaves everything in place.
      return {
        ok: false as const,
        error: "Nothing was deleted — something went wrong. Please try again.",
      };
    }
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ confirm: z.string().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.confirm !== CONFIRM_PHRASES.account)
      return { ok: false as const, error: "Type DELETE to confirm." };
    const uid = context.userId;
    try {
      // 1. All app data in one transaction (as the user, so RLS applies).
      await runDelete(context.supabase, "all_data");
      const { error: pErr } = await context.supabase.from("profiles").delete().eq("id", uid);
      if (pErr) throw new Error("profile");
    } catch {
      auditLog("delete_account", uid, false, "data");
      return {
        ok: false as const,
        error: "Your account wasn't deleted — something went wrong. Please try again.",
      };
    }
    // 2. The sign-in account itself needs admin rights; the caller was verified above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) {
      auditLog("delete_account", uid, false, "auth");
      return {
        ok: false as const,
        partial: true,
        error:
          "Your journal data was deleted, but closing the sign-in account failed. Please try Delete Account again.",
      };
    }
    auditLog("delete_account", uid, true);
    return { ok: true as const };
  });
