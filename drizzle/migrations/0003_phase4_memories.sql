ALTER TABLE public.memories
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ADD COLUMN journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN memory_type text NOT NULL DEFAULT 'other',
  ADD COLUMN importance_score numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN confidence_score numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN last_referenced_at timestamptz,
  ADD COLUMN embedding_v public.halfvec(3072),
  ADD COLUMN embedding_model text,
  ADD COLUMN embedding_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN embedding_error text,
  ADD COLUMN superseded_by uuid REFERENCES public.memories(id) ON DELETE SET NULL,
  ADD COLUMN previous_content text;

ALTER TABLE public.memories
  ADD CONSTRAINT memories_type_chk CHECK (memory_type IN ('person','goal','preference','event','decision','concern','achievement','project','relationship','habit','belief','other')),
  ADD CONSTRAINT memories_emb_status_chk CHECK (embedding_status IN ('pending','ready','failed')),
  ADD CONSTRAINT memories_scores_chk CHECK (importance_score BETWEEN 0 AND 1 AND confidence_score BETWEEN 0 AND 1);

COMMENT ON COLUMN public.memories.embedding IS 'DEPRECATED: replaced by embedding_v (halfvec 3072)';
COMMENT ON COLUMN public.memories.kind IS 'DEPRECATED: replaced by memory_type';
COMMENT ON COLUMN public.memories.importance IS 'DEPRECATED: replaced by importance_score';

CREATE INDEX IF NOT EXISTS memories_user_idx ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS memories_entry_idx ON public.memories(journal_entry_id);
CREATE INDEX IF NOT EXISTS memories_created_idx ON public.memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memories_embedding_hnsw ON public.memories USING hnsw (embedding_v public.halfvec_cosine_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
REVOKE ALL ON public.memories FROM anon;

CREATE OR REPLACE FUNCTION public.match_memories(query_embedding public.halfvec(3072), match_count int DEFAULT 8, min_similarity float DEFAULT 0.5)
RETURNS TABLE (id uuid, content text, memory_type text, journal_entry_id uuid, created_at timestamptz, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT m.id, m.content, m.memory_type, m.journal_entry_id, m.created_at,
         1 - (m.embedding_v <=> query_embedding) AS similarity
  FROM public.memories m
  WHERE auth.uid() IS NOT NULL
    AND m.user_id = auth.uid()
    AND m.embedding_v IS NOT NULL
    AND m.superseded_by IS NULL
    AND 1 - (m.embedding_v <=> query_embedding) >= min_similarity
  ORDER BY m.embedding_v <=> query_embedding
  LIMIT least(greatest(match_count, 1), 10);
$$;
REVOKE ALL ON FUNCTION public.match_memories(public.halfvec, int, float) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_memories(public.halfvec, int, float) TO authenticated;