# Reflective — project spec (as built)

Private AI journal and reflection companion. Not a medical product.

## Architecture
- TanStack Start (React 19, Vite), Tailwind v4 + shadcn. Signed-in screens under `src/routes/_authenticated/`.
- Lovable Cloud (Postgres, Auth, RLS, pgvector). AI through server functions only (`src/lib/*.functions.ts` → `src/lib/ai/*.server.ts`); these replace the spec's Edge Functions.
- Memory: analysis → memory candidates → embeddings (`halfvec(3072)`, HNSW cosine) → `match_memories` / `match_entries` (invoker rights, auth.uid()-scoped).
- Voice: `src/lib/voice/` providers (realtime WebRTC when `OPENAI_API_KEY` exists, otherwise turn-by-turn). Audio never stored.
- PWA: `public/manifest.webmanifest`, `public/sw.js` (shell-only: caches just `/offline.html`; never journal data or API calls; not registered in preview/iframes).
- Abuse protection: `consume_ai_quota` + `ai_usage` per-user windows (`src/lib/ai/rate-limit.server.ts`). Finishing a reflection is never limited.

## Schema
profiles, journal_sessions, journal_messages, journal_entries, session_summaries, memories, topics, entry_topics, people, entry_people, goals, goal_checkins, mood_entries, weekly_reports, ai_usage. Every table: `user_id`, RLS `auth.uid() = user_id`, explicit grants. Preferences live on profiles.

## Tests
- `bunx vitest run` — unit tests (weekly math/validation, voice types).
- `scripts/security-check.ts` — 34 cross-account/signed-out checks over every table and RPC.

## Known limitations
- Live voice needs `OPENAI_API_KEY`; untested end to end.
- Not tested on real iPhone/Android or Safari; notifications are preferences only (no sending).
- pgvector extension sits in the public schema (linter warning; moving it would break the vector columns).
