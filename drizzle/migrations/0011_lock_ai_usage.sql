-- Usage rows can only be written by consume_ai_quota; users can read but never insert or delete them.
DROP POLICY IF EXISTS "own usage delete" ON public.ai_usage;
DROP POLICY IF EXISTS "own usage insert" ON public.ai_usage;
REVOKE INSERT, UPDATE, DELETE ON public.ai_usage FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_kind text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  used integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_kind NOT IN ('chat','analysis','ask','weekly','voice','speak','realtime') THEN RAISE EXCEPTION 'unknown quota kind'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN RAISE EXCEPTION 'invalid limit'; END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN RAISE EXCEPTION 'invalid window'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text || p_kind));
  SELECT count(*) INTO used FROM public.ai_usage
   WHERE user_id = uid AND kind = p_kind AND created_at > now() - make_interval(secs => p_window_seconds);
  IF used >= p_limit THEN RETURN false; END IF;
  INSERT INTO public.ai_usage (user_id, kind) VALUES (uid, p_kind);
  DELETE FROM public.ai_usage WHERE user_id = uid AND created_at < now() - interval '2 days';
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(text, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, integer, integer) TO authenticated;

-- Only works inside delete_all_personal_data (transaction-local flag), so it cannot be used to reset quota on its own.
CREATE OR REPLACE FUNCTION public.clear_my_ai_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF coalesce(current_setting('reflective.deleting_all', true), '') <> 'on' THEN
    RAISE EXCEPTION 'only available when deleting all personal data';
  END IF;
  DELETE FROM public.ai_usage WHERE user_id = uid;
END $$;
REVOKE EXECUTE ON FUNCTION public.clear_my_ai_usage() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.clear_my_ai_usage() TO authenticated;

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
  PERFORM set_config('reflective.deleting_all', 'on', true);
  PERFORM public.clear_my_ai_usage();
  PERFORM set_config('reflective.deleting_all', '', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_all_personal_data() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_all_personal_data() TO authenticated;