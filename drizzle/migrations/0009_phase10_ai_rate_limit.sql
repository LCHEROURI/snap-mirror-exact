CREATE TABLE public.ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own usage read" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own usage insert" ON public.ai_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX ai_usage_user_kind_time ON public.ai_usage (user_id, kind, created_at DESC);

-- Returns true and records one use when under the limit; false when the caller is over it.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_kind text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  used integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text || p_kind));
  SELECT count(*) INTO used FROM public.ai_usage
   WHERE user_id = uid AND kind = p_kind AND created_at > now() - make_interval(secs => p_window_seconds);
  IF used >= p_limit THEN RETURN false; END IF;
  INSERT INTO public.ai_usage (user_id, kind) VALUES (uid, p_kind);
  DELETE FROM public.ai_usage WHERE user_id = uid AND created_at < now() - interval '2 days';
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text, integer, integer) TO authenticated;
CREATE POLICY "own usage delete" ON public.ai_usage FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT DELETE ON public.ai_usage TO authenticated;