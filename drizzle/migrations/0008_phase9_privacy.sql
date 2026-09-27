ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS preferred_interaction text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS voice_name text,
  ADD COLUMN IF NOT EXISTS auto_play_responses boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_report_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reflection_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'system';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pref_interaction_chk CHECK (preferred_interaction IN ('voice','writing','both')) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_theme_chk CHECK (theme IN ('system','light','dark')) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_voice_name_chk CHECK (voice_name IS NULL OR voice_name IN ('Kore','Puck','Charon','Aoede','Leda','Orus')) NOT VALID;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_first_name_len CHECK (first_name IS NULL OR char_length(first_name) <= 60) NOT VALID;

-- Deletes one entry, its transcript (session + messages) and mood check-ins tied to it.
-- Memories, goals, topics and people survive; their source links are nulled by FKs.
CREATE OR REPLACE FUNCTION public.delete_journal_entry(p_entry_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); sid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT session_id INTO sid FROM journal_entries WHERE id = p_entry_id AND user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  DELETE FROM mood_entries WHERE user_id = uid AND (journal_entry_id = p_entry_id OR (sid IS NOT NULL AND session_id = sid));
  DELETE FROM journal_entries WHERE id = p_entry_id AND user_id = uid;
  IF sid IS NOT NULL THEN
    DELETE FROM journal_messages WHERE session_id = sid AND user_id = uid;
    DELETE FROM journal_sessions WHERE id = sid AND user_id = uid;
  END IF;
END $$;

-- Journal history: entries, sessions, messages, entry links, entry/session mood, weekly reflections.
-- Keeps account, preferences, goals, memories, topics, people and standalone mood check-ins.
CREATE OR REPLACE FUNCTION public.delete_journal_history()
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  DELETE FROM mood_entries WHERE user_id = uid AND (journal_entry_id IS NOT NULL OR session_id IS NOT NULL);
  DELETE FROM weekly_reports WHERE user_id = uid;
  DELETE FROM entry_topics WHERE user_id = uid;
  DELETE FROM entry_people WHERE user_id = uid;
  DELETE FROM journal_entries WHERE user_id = uid;
  DELETE FROM journal_messages WHERE user_id = uid;
  DELETE FROM session_summaries WHERE user_id = uid;
  DELETE FROM session_topics WHERE user_id = uid;
  DELETE FROM session_people WHERE user_id = uid;
  DELETE FROM session_goals WHERE user_id = uid;
  DELETE FROM journal_sessions WHERE user_id = uid;
END $$;

-- Memories (and their embeddings, stored on the same rows). Nothing else.
CREATE OR REPLACE FUNCTION public.delete_all_memories()
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE memories SET superseded_by = NULL WHERE user_id = uid AND superseded_by IS NOT NULL;
  DELETE FROM memories WHERE user_id = uid;
END $$;

-- All journal product data in one transaction. Keeps the sign-in account and profile/preferences.
CREATE OR REPLACE FUNCTION public.delete_all_personal_data()
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.delete_journal_history();
  PERFORM public.delete_all_memories();
  DELETE FROM mood_entries WHERE user_id = uid;
  DELETE FROM goal_checkins WHERE user_id = uid;
  DELETE FROM goals WHERE user_id = uid;
  DELETE FROM topics WHERE user_id = uid;
  DELETE FROM people WHERE user_id = uid;
END $$;

REVOKE ALL ON FUNCTION public.delete_journal_entry(uuid), public.delete_journal_history(), public.delete_all_memories(), public.delete_all_personal_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_journal_entry(uuid), public.delete_journal_history(), public.delete_all_memories(), public.delete_all_personal_data() TO authenticated, service_role;