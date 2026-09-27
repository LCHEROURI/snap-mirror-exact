import type { SupabaseClient } from "@supabase/supabase-js";

// Per-user limits on expensive AI calls. Counts live in ai_usage (RLS-scoped to the caller).
export const LIMITS = {
  chat: { limit: 60, windowSec: 600 },
  analysis: { limit: 20, windowSec: 3600 },
  ask: { limit: 30, windowSec: 3600 },
  weekly: { limit: 10, windowSec: 3600 },
  voice: { limit: 60, windowSec: 600 },
  speak: { limit: 120, windowSec: 600 },
  realtime: { limit: 10, windowSec: 3600 },
} as const;
export type QuotaKind = keyof typeof LIMITS;

export const RATE_LIMITED = {
  ok: false as const,
  code: "rate_limited",
  error:
    "You've been going quickly — please wait a few minutes and try again. Nothing you've written is lost.",
};

/** true = allowed. Fails open on database errors so journaling is never blocked by the limiter itself. */
export async function allowAi(supabase: SupabaseClient<any>, kind: QuotaKind): Promise<boolean> {
  const { limit, windowSec } = LIMITS[kind];
  const { data, error } = await supabase.rpc("consume_ai_quota", {
    p_kind: kind,
    p_limit: limit,
    p_window_seconds: windowSec,
  });
  if (error) {
    console.error("[rate-limit] check failed", kind, error.code);
    return true;
  }
  if (data === false) console.warn("[rate-limit] limited", kind);
  return data !== false;
}
