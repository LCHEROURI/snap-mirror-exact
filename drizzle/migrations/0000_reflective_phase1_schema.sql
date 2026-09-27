CREATE EXTENSION IF NOT EXISTS vector;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  display_name TEXT,
  journaling_intention TEXT,
  reminder_preference TEXT NOT NULL DEFAULT 'none',
  ai_memory_enabled BOOLEAN NOT NULL DEFAULT true,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- SESSIONS
CREATE TABLE public.journal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  mood_score SMALLINT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX journal_sessions_user_started_idx ON public.journal_sessions (user_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_sessions TO authenticated;
GRANT ALL ON public.journal_sessions TO service_role;
ALTER TABLE public.journal_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions select" ON public.journal_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own sessions insert" ON public.journal_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sessions update" ON public.journal_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sessions delete" ON public.journal_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MESSAGES
CREATE TABLE public.journal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.journal_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX journal_messages_session_idx ON public.journal_messages (session_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_messages TO authenticated;
GRANT ALL ON public.journal_messages TO service_role;
ALTER TABLE public.journal_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages select" ON public.journal_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own messages insert" ON public.journal_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own messages update" ON public.journal_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own messages delete" ON public.journal_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SUMMARIES
CREATE TABLE public.session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.journal_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  summary TEXT NOT NULL,
  themes TEXT[] NOT NULL DEFAULT '{}',
  notable_moments TEXT[] NOT NULL DEFAULT '{}',
  next_prompt TEXT,
  mood_score SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_summaries TO authenticated;
GRANT ALL ON public.session_summaries TO service_role;
ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own summaries select" ON public.session_summaries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own summaries insert" ON public.session_summaries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own summaries update" ON public.session_summaries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own summaries delete" ON public.session_summaries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MEMORIES (pgvector)
CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'fact',
  importance SMALLINT NOT NULL DEFAULT 3,
  source_session_id UUID REFERENCES public.journal_sessions(id) ON DELETE SET NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX memories_user_idx ON public.memories (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memories select" ON public.memories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own memories insert" ON public.memories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own memories update" ON public.memories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own memories delete" ON public.memories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TOPICS
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own topics select" ON public.topics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own topics insert" ON public.topics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own topics update" ON public.topics FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own topics delete" ON public.topics FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PEOPLE
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own people select" ON public.people FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own people insert" ON public.people FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own people update" ON public.people FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own people delete" ON public.people FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- GOALS
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  progress SMALLINT NOT NULL DEFAULT 0,
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals select" ON public.goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own goals insert" ON public.goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own goals update" ON public.goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own goals delete" ON public.goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- GOAL CHECKINS
CREATE TABLE public.goal_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  note TEXT,
  progress SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_checkins TO authenticated;
GRANT ALL ON public.goal_checkins TO service_role;
ALTER TABLE public.goal_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins select" ON public.goal_checkins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own checkins insert" ON public.goal_checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own checkins update" ON public.goal_checkins FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own checkins delete" ON public.goal_checkins FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MOOD ENTRIES
CREATE TABLE public.mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.journal_sessions(id) ON DELETE SET NULL,
  score SMALLINT NOT NULL,
  note TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mood_entries_user_idx ON public.mood_entries (user_id, recorded_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mood_entries TO authenticated;
GRANT ALL ON public.mood_entries TO service_role;
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own moods select" ON public.mood_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own moods insert" ON public.mood_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own moods update" ON public.mood_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own moods delete" ON public.mood_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- LINK TABLES
CREATE TABLE public.session_topics (
  session_id UUID NOT NULL REFERENCES public.journal_sessions(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  PRIMARY KEY (session_id, topic_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_topics TO authenticated;
GRANT ALL ON public.session_topics TO service_role;
ALTER TABLE public.session_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own session_topics select" ON public.session_topics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own session_topics insert" ON public.session_topics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own session_topics delete" ON public.session_topics FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.session_people (
  session_id UUID NOT NULL REFERENCES public.journal_sessions(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  PRIMARY KEY (session_id, person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_people TO authenticated;
GRANT ALL ON public.session_people TO service_role;
ALTER TABLE public.session_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own session_people select" ON public.session_people FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own session_people insert" ON public.session_people FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own session_people delete" ON public.session_people FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.session_goals (
  session_id UUID NOT NULL REFERENCES public.journal_sessions(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  PRIMARY KEY (session_id, goal_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_goals TO authenticated;
GRANT ALL ON public.session_goals TO service_role;
ALTER TABLE public.session_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own session_goals select" ON public.session_goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own session_goals insert" ON public.session_goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own session_goals delete" ON public.session_goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- WEEKLY REPORTS
CREATE TABLE public.weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_reports TO authenticated;
GRANT ALL ON public.weekly_reports TO service_role;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports select" ON public.weekly_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own reports insert" ON public.weekly_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reports update" ON public.weekly_reports FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reports delete" ON public.weekly_reports FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER memories_touch BEFORE UPDATE ON public.memories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER goals_touch BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
