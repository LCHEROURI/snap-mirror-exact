import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  display_name: string | null;
  journaling_intention: string | null;
  reminder_preference: string;
  ai_memory_enabled: boolean;
  onboarded_at: string | null;
  first_name: string | null;
  reflection_style: string | null;
  preferred_interaction: string;
  timezone: string | null;
  voice_enabled: boolean;
  voice_name: string | null;
  auto_play_responses: boolean;
  weekly_report_enabled: boolean;
  reflection_reminders_enabled: boolean;
  theme: string;
};

const PROFILE_COLS = "id, display_name, first_name, journaling_intention, reminder_preference, ai_memory_enabled, onboarded_at, reflection_style, preferred_interaction, timezone, voice_enabled, voice_name, auto_play_responses, weekly_report_enabled, reflection_reminders_enabled, theme";

/** Reads the signed-in user's profile, creating the row on first visit. */
export async function fetchOrCreateProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as Profile;

  const suggestedName =
    (user.user_metadata?.["full_name"] as string | undefined) ??
    (user.user_metadata?.["name"] as string | undefined) ??
    null;

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, display_name: suggestedName })
    .select(PROFILE_COLS)
    .single();
  if (insertError) throw insertError;
  return created as Profile;
}

export const profileQueryOptions = {
  queryKey: ["profile"] as const,
  queryFn: fetchOrCreateProfile,
};
