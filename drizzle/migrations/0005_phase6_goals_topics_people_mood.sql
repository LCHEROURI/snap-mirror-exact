-- GOALS
ALTER TABLE public.goals
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ADD COLUMN created_from_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN next_actions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.goals ADD CONSTRAINT goals_status_chk CHECK (status IN ('active','paused','completed','archived')) NOT VALID;
COMMENT ON COLUMN public.goals.progress IS 'DEPRECATED: progress lives on goal_checkins';
CREATE INDEX IF NOT EXISTS goals_user_idx ON public.goals(user_id, status);
CREATE INDEX IF NOT EXISTS goals_entry_idx ON public.goals(created_from_entry_id);

ALTER TABLE public.goal_checkins ALTER COLUMN user_id SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS goal_checkins_goal_idx ON public.goal_checkins(goal_id, created_at DESC);
DROP POLICY IF EXISTS "own checkins insert" ON public.goal_checkins;
CREATE POLICY "own checkins insert" ON public.goal_checkins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid()));

ALTER TABLE public.journal_entries ADD COLUMN dismissed_goal_candidates text[] NOT NULL DEFAULT '{}';

-- TOPICS / PEOPLE
ALTER TABLE public.topics ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS topics_user_name_uq ON public.topics(user_id, lower(name));

ALTER TABLE public.people ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ADD COLUMN notes text,
  ADD COLUMN name_key text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS people_user_key_idx ON public.people(user_id, name_key);

CREATE TABLE public.entry_topics (
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, topic_id)
);
GRANT SELECT, INSERT, DELETE ON public.entry_topics TO authenticated;
GRANT ALL ON public.entry_topics TO service_role;
ALTER TABLE public.entry_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own entry_topics select" ON public.entry_topics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own entry_topics delete" ON public.entry_topics FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own entry_topics insert" ON public.entry_topics FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.id = entry_id AND e.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.topics t WHERE t.id = topic_id AND t.user_id = auth.uid()));
CREATE INDEX entry_topics_topic_idx ON public.entry_topics(topic_id);

CREATE TABLE public.entry_people (
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, person_id)
);
GRANT SELECT, INSERT, DELETE ON public.entry_people TO authenticated;
GRANT ALL ON public.entry_people TO service_role;
ALTER TABLE public.entry_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own entry_people select" ON public.entry_people FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own entry_people delete" ON public.entry_people FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own entry_people insert" ON public.entry_people FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.id = entry_id AND e.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_id AND p.user_id = auth.uid()));
CREATE INDEX entry_people_person_idx ON public.entry_people(person_id);

COMMENT ON TABLE public.session_topics IS 'DEPRECATED: replaced by entry_topics';
COMMENT ON TABLE public.session_people IS 'DEPRECATED: replaced by entry_people';

-- MOOD
ALTER TABLE public.mood_entries ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ADD COLUMN journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN label text;
ALTER TABLE public.mood_entries ADD CONSTRAINT mood_score_chk CHECK (score BETWEEN 1 AND 5) NOT VALID;
CREATE INDEX IF NOT EXISTS mood_user_idx ON public.mood_entries(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS mood_entry_idx ON public.mood_entries(journal_entry_id);

-- MERGES: invoker rights (RLS applies) + explicit ownership checks; atomic.
CREATE OR REPLACE FUNCTION public.merge_topics(source_id uuid, target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF source_id = target_id THEN RAISE EXCEPTION 'same topic'; END IF;
  IF (SELECT count(*) FROM topics WHERE id IN (source_id, target_id) AND user_id = auth.uid()) <> 2 THEN
    RAISE EXCEPTION 'not found';
  END IF;
  INSERT INTO entry_topics(entry_id, topic_id, user_id)
    SELECT entry_id, target_id, auth.uid() FROM entry_topics WHERE topic_id = source_id
    ON CONFLICT DO NOTHING;
  DELETE FROM topics WHERE id = source_id AND user_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.merge_people(source_id uuid, target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF source_id = target_id THEN RAISE EXCEPTION 'same person'; END IF;
  IF (SELECT count(*) FROM people WHERE id IN (source_id, target_id) AND user_id = auth.uid()) <> 2 THEN
    RAISE EXCEPTION 'not found';
  END IF;
  SELECT * INTO s FROM people WHERE id = source_id;
  INSERT INTO entry_people(entry_id, person_id, user_id)
    SELECT entry_id, target_id, auth.uid() FROM entry_people WHERE person_id = source_id
    ON CONFLICT DO NOTHING;
  UPDATE people SET
    relationship = coalesce(relationship, s.relationship),
    notes = CASE WHEN s.notes IS NULL THEN notes WHEN notes IS NULL THEN s.notes ELSE notes || E'\n' || s.notes END,
    updated_at = now()
  WHERE id = target_id;
  DELETE FROM people WHERE id = source_id AND user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.merge_topics(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merge_people(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_topics(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid) TO authenticated;