# Reflective — Phased Plan

An AI journaling and reflection companion: you talk, it listens, it remembers what matters, and it helps you see patterns over time. Not a therapist or medical tool — wording and disclaimers reflect that throughout.

## How this maps to Lovable

Your brief assumes a classic Supabase + Edge Functions + OpenAI setup. On Lovable the equivalents are:

- Database, accounts, file storage, vector search: Lovable Cloud (Postgres + auth + pgvector under the hood). Same row-level security model you described.
- Server-side AI logic: built-in server functions instead of separate edge functions. Same rule — keys never touch the browser.
- AI models: the built-in AI gateway (Gemini/OpenAI models, billed through Lovable credits) so no external account is needed. If you'd rather use your own OpenAI account, we add your key as a secret instead. Live voice in Phase 8 needs your own OpenAI key either way.

The memory pipeline you specified is kept exactly: conversation → session → messages → structured summary → extracted memories/topics/people/goals → embeddings → vector store → retrieve only relevant memories. Full history is never sent to the model.

---

## Phase 1 — Shell, design system, auth, onboarding, schema, security

Built: design direction chosen from rendered options, app shell with mobile-first navigation, sign up / sign in / sign out, short onboarding (name, what you want from journaling, reminder preference), empty states.
Data: profiles, sessions, messages, summaries, memories, topics, people, goals, mood entries, weekly reports — all keyed to the owner with row-level security and explicit grants from day one. pgvector enabled now so later phases need no migration.
Server: none beyond auth.
Credentials: none.
Tests: sign up, sign in, sign out, refresh persistence; a second account cannot read the first account's rows.
Depends on: nothing.

## Phase 2 — Text journaling and history

Built: new-session screen with a chat-style composer, message list, session save/resume, history list grouped by date, session detail view, delete a session.
Data: reads/writes sessions and messages.
Server: create session, append message, list history (owner-scoped).
Credentials: none. Tests: messages persist and reload; history shows only your own sessions.
Depends on: Phase 1.

## Phase 3 — AI replies and end-of-session analysis

Built: the companion responds in-conversation with reflective follow-up questions; ending a session produces a structured summary (themes, mood, notable moments, one gentle prompt for next time). Crisis-language safety response and non-clinical framing.
Data: summaries table populated; mood value stored per session.
Server: chat reply function (streamed), analyze-session function returning validated structured output.
Credentials: none with the built-in gateway; your OpenAI key if you choose that route.
Tests: reply arrives and streams; analysis produces valid structure; failures degrade gracefully without losing the journal entry.
Depends on: Phase 2.

## Phase 4 — Long-term memory and semantic retrieval

Built: memory extraction from each finished session, deduping against existing memories; a Memories screen to view, edit and delete what the app remembers; relevant-memory retrieval injected into future conversations.
Data: embeddings on memories, vector index, retrieval function scoped to the owner.
Server: embed-memory, retrieve-relevant-memories (top-k with a similarity floor and a hard token budget).
Credentials: same as Phase 3. Tests: retrieval returns only your memories; token budget respected; deleting a memory removes it from future context.
Depends on: Phase 3.

## Phase 5 — Ask My Journal

Built: a question box ("when was I last excited about work?") answering from your own entries, with citations linking back to the source sessions.
Data: reuses vector search; optional saved-questions list.
Server: ask-journal function — retrieve, then answer strictly from retrieved passages, saying so when nothing relevant is found.
Credentials: same. Tests: answers cite real sessions; no cross-account leakage; graceful empty answer.
Depends on: Phase 4.

## Phase 6 — Goals, topics, people, mood

Built: goals list with progress and check-ins; topic and people pages showing where they appear; mood chart over time. Populated automatically by Phase 3 extraction and editable by hand.
Data: link tables joining sessions to topics/people/goals.
Server: extraction extended to emit these entities; CRUD functions.
Credentials: same. Tests: entity pages show correct sessions; mood chart matches stored values.
Depends on: Phases 3–4.

## Phase 7 — Weekly reflections and insights

Built: a weekly report — themes, mood trend, goal movement, one forward-looking prompt — plus an insights screen.
Data: weekly_reports table.
Server: generate-weekly-report, callable on demand and on a schedule.
Credentials: same. Tests: report generated from a seeded week; a week with no entries is handled.
Depends on: Phases 3–6.

## Phase 8 — Live voice journaling

Built: press-to-talk voice session with live transcript, saved as a normal session so all analysis applies.
Server: ephemeral-token function for the realtime connection; transcript persistence.
Credentials: your own OpenAI key with realtime access; microphone permission.
Tests: connect, speak, see transcript, end session, see summary.
Depends on: Phases 2–4.

## Phase 9 — Privacy, export, deletion, settings

Built: settings (name, reminders, AI memory on/off, tone), export everything as JSON, delete individual items, delete account and all data with confirmation, plain-language privacy page.
Server: export-my-data, delete-my-account (cascading).
Tests: export contains all owned data and nothing else; deletion leaves no rows behind.
Depends on: Phases 1–7.

## Phase 10 — Installable app, accessibility, security pass, final testing

Built: installable on iPhone/Android with icons and offline shell, keyboard and screen-reader pass, contrast check, tablet/desktop layouts, security review of every table and function, end-to-end run of the full flow.
Depends on: all.

---

## Postpone from the MVP

- Phase 8 live voice — highest complexity and cost; plain voice-to-text dictation covers most of the value first.
- Scheduled weekly reports — ship on-demand generation first.
- Push notifications and reminder emails.
- Streaks, gamification, themes.
- Sharing, multi-device realtime sync, offline writing with sync.
- Sophisticated memory decay/consolidation — start with simple dedupe plus manual editing.

Leanest satisfying MVP: Phases 1–5, then 6.

## Technical notes

- Stack: React 19 + TypeScript + Tailwind v4 + shadcn/ui on TanStack Start; Lovable Cloud (Postgres, auth, storage, pgvector); server functions for all AI calls.
- Every user-owned table: `user_id`, RLS enabled, explicit grants, policies scoped to `auth.uid()`; roles (if ever needed) in a separate table.
- Context budget enforced server-side: last N messages + top-k retrieved memories + current summary, never full history.
- Structured AI output validated with Zod; invalid output retried once, then stored as a plain-text summary rather than lost.

## Next prompt for Phase 1

> Implement Phase 1 of Reflective only. Set up Lovable Cloud with the full database schema for profiles, sessions, messages, summaries, memories, topics, people, goals, mood entries and weekly reports — every user-owned table with user_id, RLS and grants, and pgvector enabled. Build email/password sign up, sign in, sign out with protected routes, a short onboarding flow (name, journaling intention, reminder preference), the app shell with mobile-first navigation, and the design system. Include empty states. Do not build journaling conversations or any AI features yet.
