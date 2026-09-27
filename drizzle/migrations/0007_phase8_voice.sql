ALTER TABLE public.journal_messages ADD COLUMN client_item_id text;
CREATE UNIQUE INDEX IF NOT EXISTS journal_messages_client_item_uniq ON public.journal_messages(session_id, client_item_id) WHERE client_item_id IS NOT NULL;
ALTER TABLE public.profiles ADD COLUMN voice_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.journal_sessions ADD CONSTRAINT journal_sessions_type_chk CHECK (session_type IN ('text','voice')) NOT VALID;