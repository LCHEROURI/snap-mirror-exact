ALTER TABLE public.journal_entries
  ADD COLUMN summary_embedding public.halfvec(3072),
  ADD COLUMN summary_embedding_status text NOT NULL DEFAULT 'pending'
    CHECK (summary_embedding_status IN ('pending','ready','failed'));

CREATE INDEX IF NOT EXISTS journal_entries_summary_hnsw ON public.journal_entries USING hnsw (summary_embedding public.halfvec_cosine_ops);
CREATE INDEX IF NOT EXISTS journal_entries_user_completed_idx ON public.journal_entries(user_id, completed_at DESC);

CREATE OR REPLACE FUNCTION public.match_entries(
  query_embedding public.halfvec(3072), match_count int DEFAULT 6, min_similarity float DEFAULT 0.5,
  from_ts timestamptz DEFAULT NULL, to_ts timestamptz DEFAULT NULL)
RETURNS TABLE (id uuid, title text, summary text, completed_at timestamptz, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT e.id, e.title, e.summary, e.completed_at, 1 - (e.summary_embedding <=> query_embedding)
  FROM public.journal_entries e
  WHERE auth.uid() IS NOT NULL AND e.user_id = auth.uid()
    AND e.summary_embedding IS NOT NULL
    AND (from_ts IS NULL OR e.completed_at >= from_ts)
    AND (to_ts IS NULL OR e.completed_at < to_ts)
    AND 1 - (e.summary_embedding <=> query_embedding) >= min_similarity
  ORDER BY e.summary_embedding <=> query_embedding
  LIMIT least(greatest(match_count, 1), 8);
$$;
REVOKE ALL ON FUNCTION public.match_entries(public.halfvec, int, float, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_entries(public.halfvec, int, float, timestamptz, timestamptz) TO authenticated;