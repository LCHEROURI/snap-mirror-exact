import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { placeholderCompanion } from "./companion/placeholder";
import type { CompanionTurn } from "./companion/types";

const RECENT_LIMIT = 12;

/**
 * Generates and stores the companion's reply for a session.
 * Ownership comes from the authenticated session (RLS), never from the browser.
 */
export const requestCompanionReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ sessionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sErr } = await supabase
      .from("journal_sessions")
      .select("id, status")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session) throw new Error("Session not found");
    if (session.status === "completed") throw new Error("This reflection is already finished");

    const { data: rows, error: mErr } = await supabase
      .from("journal_messages")
      .select("role, content")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT);
    if (mErr) throw new Error(mErr.message);

    const recent: CompanionTurn[] = (rows ?? [])
      .reverse()
      .filter((r) => r.role === "user" || r.role === "assistant")
      .map((r) => ({ role: r.role as CompanionTurn["role"], content: r.content }));

    // Phase 3: swap placeholderCompanion for the real AI provider.
    const reply = await placeholderCompanion.reply(recent);

    const { data: inserted, error: iErr } = await supabase
      .from("journal_messages")
      .insert({ session_id: data.sessionId, user_id: userId, role: "assistant", content: reply.content })
      .select("id, role, content, created_at")
      .single();
    if (iErr) throw new Error(iErr.message);

    return { message: inserted, provider: reply.provider };
  });
