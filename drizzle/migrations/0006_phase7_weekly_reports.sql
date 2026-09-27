ALTER TABLE public.weekly_reports
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ADD COLUMN week_end date,
  ADD COLUMN summary text,
  ADD COLUMN themes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN wins jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN challenges jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN goal_progress jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN next_week jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN worth_noticing text,
  ADD COLUMN entry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
COMMENT ON COLUMN public.weekly_reports.content IS 'DEPRECATED: replaced by structured section columns';
CREATE INDEX IF NOT EXISTS weekly_reports_user_idx ON public.weekly_reports(user_id, week_start DESC);
CREATE INDEX IF NOT EXISTS weekly_reports_created_idx ON public.weekly_reports(created_at);
CREATE TRIGGER weekly_reports_touch BEFORE UPDATE ON public.weekly_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
ALTER TABLE public.profiles ADD COLUMN timezone text;