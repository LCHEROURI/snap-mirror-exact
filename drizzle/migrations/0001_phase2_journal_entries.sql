ALTER TABLE public.journal_sessions ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'text';
ALTER TABLE public.journal_sessions ADD CONSTRAINT journal_sessions_type_check CHECK (session_type IN ('text','voice'));
ALTER TABLE public.journal_sessions ADD CONSTRAINT journal_sessions_status_check CHECK (status IN ('active','paused','completed'));
ALTER TABLE public.journal_sessions ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.journal_messages ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.journal_messages ADD CONSTRAINT journal_messages_role_check CHECK (role IN ('user','assistant','system'));
CREATE INDEX IF NOT EXISTS journal_messages_session_idx ON public.journal_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS journal_sessions_user_idx ON public.journal_sessions(user_id, started_at DESC);

DROP POLICY IF EXISTS "own messages insert" ON public.journal_messages;
CREATE POLICY "own messages insert" ON public.journal_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.journal_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  session_id uuid UNIQUE REFERENCES public.journal_sessions(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled reflection',
  preview text,
  session_type text NOT NULL DEFAULT 'text' CHECK (session_type IN ('text','voice')),
  message_count integer NOT NULL DEFAULT 0,
  word_count integer NOT NULL DEFAULT 0,
  mood_score smallint,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own entries select" ON public.journal_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own entries insert" ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (session_id IS NULL OR EXISTS (SELECT 1 FROM public.journal_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())));
CREATE POLICY "own entries update" ON public.journal_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own entries delete" ON public.journal_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX journal_entries_user_idx ON public.journal_entries(user_id, started_at DESC);
CREATE TRIGGER journal_entries_touch BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();