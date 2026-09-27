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
  DELETE FROM ai_usage WHERE user_id = uid;
END $$;