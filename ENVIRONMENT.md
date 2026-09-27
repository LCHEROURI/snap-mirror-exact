# Environment

Names only — never commit values. Server variables are read inside server handlers only.

## Browser-safe (auto-provided)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

## Server-only (auto-provided by Lovable Cloud)
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — used only for account deletion (auth user removal)
- `LOVABLE_API_KEY` — AI gateway (chat, analysis, embeddings, transcription, speech)

## Optional
- `OPENAI_API_KEY` — enables live (realtime WebRTC) voice. Without it, voice uses the turn-by-turn mode.
- Model overrides (defaults in `src/lib/ai/config.server.ts` / `voiceConfig()`):
  `JOURNAL_CHAT_MODEL`, `JOURNAL_ANALYSIS_MODEL`, `ASK_JOURNAL_MODEL`, `WEEKLY_REPORT_MODEL`,
  `EMBEDDING_MODEL` (must stay 3072-dim unless the column is migrated), `TRANSCRIPTION_MODEL`,
  `TTS_MODEL`, `TTS_VOICE`, `REALTIME_MODEL`, `REALTIME_VOICE`, `REALTIME_TRANSCRIPTION_MODEL`.

## Setup
- Local: `bun install && bun run dev`. Migrations live in `drizzle/migrations/` and are applied in order.
- Tests: `bunx vitest run`; cross-account security: `bun scripts/security-check.ts` (needs the server-only vars; creates and deletes two temporary accounts).
- Deploy: publish from Lovable. Auth email confirmation stays on; add the published domain to auth redirect URLs.
