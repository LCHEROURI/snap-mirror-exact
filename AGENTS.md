<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Reflective architecture rules

- All AI work runs server-side through `createServerFn` (no Edge Functions), so model keys and prompts never reach the browser.
- Signed-in screens live under `src/routes/_authenticated/`; the pathless layout owns the auth gate so child routes carry no auth code.
- Journal context sent to a model is always last-N messages + top-k retrieved memories, never full history — keeps cost and privacy bounded.
- Every user-owned table carries `user_id`, RLS scoped to `auth.uid()`, and explicit GRANTs; `memories.embedding` is pgvector for semantic retrieval.
- AI lives in `src/lib/ai/*.server.ts` (config, gateway, prompts, safety, journal-ai) and is exposed only via `src/lib/companion.functions.ts`; server functions stand in for the spec's Edge Functions (journal-chat, finish-journal-session). Model ids come from `JOURNAL_CHAT_MODEL`/`JOURNAL_ANALYSIS_MODEL` env with defaults in config.server.ts.
- Finishing always saves the entry before analysis; analysis output is validated by `validateAnalysis` and failures set `analysis_status='failed'` with a retry path, never touching the transcript.
- Journal data access lives in `src/lib/journal.ts` using the browser client; `user_id` defaults to `auth.uid()` and insert policies verify session ownership, so the browser can't claim another owner.
- Shared signed-in chrome lives in `src/components/app-shell.tsx` (bottom tabs on mobile, side rail on desktop).

## Project Master Specification / Vibe Spec

Build a production-quality full-stack responsive web application and installable PWA called **Reflective**.

Reflective is a private AI-powered journal and personal reflection companion. It should capture text and voice conversations, transform conversations into structured journal entries, remember important themes over time, track goals and recurring patterns, and let users ask questions across their personal journal history.

This product is inspired by the general category of AI journaling applications, but DO NOT copy Rosebud's branding, proprietary wording, prompts, visual design, page layouts, assets, or trademarked elements.

The application must have its own original visual identity and architecture.

# PRIMARY PRODUCT GOAL

Create an AI journaling experience where the user can:

1. Speak naturally with an AI reflection companion.
2. Type instead of speaking whenever desired.
3. Save the conversation as a journal session.
4. Generate an intelligent journal summary after the conversation.
5. Automatically identify themes, people, goals, decisions, emotions, concerns, and wins.
6. Build long-term memory from previous entries.
7. Retrieve relevant previous memories during future conversations.
8. Ask questions across the user's journal history.
9. Generate weekly reflections.
10. Track personal goals and small next actions.

This is NOT a medical application and the AI must never present itself as a therapist, psychologist, psychiatrist, counselor, physician, or other healthcare professional.

Use terminology such as:

- reflection companion
- AI journal
- personal reflection
- guided journaling
- insights
- patterns

Avoid:

- diagnosis
- treatment
- therapy replacement
- clinical assessment

# TECHNOLOGY STACK

Use:

Frontend:

- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- responsive mobile-first design
- installable PWA

Backend:

- Supabase PostgreSQL
- Supabase Authentication
- Supabase Edge Functions
- Supabase Storage if later required
- Supabase Row Level Security

AI:

- OpenAI API through server-side Supabase Edge Functions
- OpenAI Realtime API for live voice conversation where available
- OpenAI embeddings for semantic memory retrieval

Memory:

- Supabase pgvector

Never expose OpenAI secret keys or Supabase service-role credentials in browser code.

All privileged AI calls must be routed through secure backend functions.

# PRODUCT DESIGN

Create an elegant, calm, sophisticated interface.

Do not make it look clinical.

Visual characteristics:

- generous whitespace
- rounded cards
- soft surfaces
- restrained typography
- high readability
- subtle animation
- premium but quiet appearance
- excellent mobile experience
- dark mode and light mode
- WCAG-aware contrast
- no clutter
- no childish illustrations

Primary navigation on desktop:

Home
Journal
Insights
Ask My Journal
Goals
Settings

On mobile use a bottom navigation bar:

Home
Journal
Voice
Insights
Goals

Put the main voice action in a prominent center button.

# AUTHENTICATION

Implement Supabase authentication.

Support:

- email/password
- magic link if easily supported
- password reset
- logout
- persistent sessions

After first signup show onboarding.

# ONBOARDING

Create a short onboarding flow.

Screen 1:
Welcome to Reflective.

Explain in simple language:

"Reflective helps you think out loud, capture what matters, and notice patterns over time."

Screen 2:
Ask:

"What would you like Reflective to help you with?"

Selectable options:

- Understand myself better
- Build healthier habits
- Work through decisions
- Track goals
- Reduce mental clutter
- Record my life
- Something else

Allow multiple selections.

Screen 3:

Preferred interaction:

- Voice
- Writing
- Both

Screen 4:

Reflection style:

- Gentle
- Curious
- Direct
- Practical

Store this preference.

Screen 5:

Privacy explanation.

Explain that journal information is private to the user's account and is used to create personalized reflections.

Provide:

Start Journaling button.

# HOME SCREEN

Create a personalized dashboard.

Header:

Good morning / afternoon / evening, [first name]

Main card:

"What's on your mind?"

Buttons:

Talk
Write

Below:

Continue today's reflection

Recent journal entries

Current goals

One insight from this week

Journal streak

Do not over-gamify the product.

# TEXT JOURNAL EXPERIENCE

Create a conversational journal interface.

The screen should resemble a calm messaging interface rather than a generic chatbot.

User messages aligned right.

Reflection companion responses aligned left.

Bottom composer:

text input
microphone icon
send button

AI responses should typically:

1. acknowledge what the user said,
2. identify something meaningful,
3. ask ONE thoughtful follow-up question.

Avoid interrogating the user with multiple questions.

Add controls:

Pause
Finish reflection
Save

When user selects Finish Reflection:

call backend function to generate structured journal analysis.

Save:

- complete transcript
- short title
- narrative summary
- important memories
- people mentioned
- topics
- emotions
- decisions
- wins
- concerns
- goals
- possible next actions

# LIVE VOICE MODE

Create a dedicated full-screen Voice Reflection experience.

Large animated microphone/orb in center.

States:

Connecting
Listening
Thinking
Speaking
Paused

Use OpenAI Realtime API with WebRTC if configuration is available.

Architecture:

browser
→ secure Supabase Edge Function
→ creates/authenticates realtime session
→ browser establishes WebRTC connection
→ live speech interaction

Never put a permanent OpenAI API key in the frontend.

Voice requirements:

- natural back-and-forth speech
- interruption/barge-in when supported
- user can mute microphone
- user can end session
- show live transcript
- save transcript
- convert finished voice session into normal journal entry

If realtime voice configuration is not yet available, build the UI and backend abstraction cleanly and provide a fallback:

record audio
→ speech transcription
→ AI response
→ text-to-speech playback

Do not fake live voice functionality.

Clearly isolate the voice provider implementation so it can be swapped later.

# JOURNAL HISTORY

Create Journal screen.

Show entries chronologically.

Each card:

date
title
short summary
mood indicator
topics
duration

Controls:

Search
Filter
Calendar
Topics

Entry detail page should display:

date/time
conversation transcript
summary
themes
people mentioned
goals/actions
related memories

Allow user to edit the journal title and narrative summary.

Do not modify the original transcript.

# LONG-TERM MEMORY SYSTEM

This is one of the most important features.

Enable Supabase pgvector.

Create a memory system.

Each significant memory should contain:

id
user_id
journal_entry_id
memory_type
content
importance_score
confidence_score
created_at
last_referenced_at
embedding

Memory types:

person
goal
preference
event
decision
concern
achievement
project
relationship
habit
belief
other

After journal analysis:

extract durable memories.

Do NOT store every sentence as memory.

Only store information likely to matter in future reflections.

Generate embedding for each memory.

During a new journal conversation:

take the user's latest message
→ generate/retrieve semantic context
→ query pgvector
→ retrieve approximately 5-10 most relevant memories
→ add only relevant memories to AI context.

Do not dump the user's entire journal history into every prompt.

Prevent memories from different users from ever being retrieved together.

# MEMORY MANAGEMENT SCREEN

Inside Settings add:

Memory

Show saved long-term memories.

Allow user to:

view memory
edit memory
delete memory
disable memory entirely

Provide:

Delete all memories

This must require confirmation.

Deleting memory must not automatically delete original journal entries unless user explicitly chooses to delete those separately.

# ASK MY JOURNAL

Create screen:

Ask My Journal

Large question box:

"Ask anything about your journal..."

Example prompts:

"What has been stressing me lately?"

"What have I said about work?"

"What goals do I keep postponing?"

"What made me happiest this month?"

"What decisions have I been struggling with?"

When user asks:

1. generate query embedding
2. retrieve relevant memories and journal excerpts belonging ONLY to that user
3. provide answer grounded in retrieved journal content

Whenever possible show:

Related entries

with dates users can open.

Never invent memories.

When evidence is weak, say:

"I don't have enough journal history to answer that confidently yet."

# PEOPLE SYSTEM

Create People screen accessible through Insights.

Automatically extract frequently mentioned people.

Database fields:

id
user_id
display_name
relationship_label nullable
notes
created_at
updated_at

Examples:

Sarah
Son
Manager
Friend

Never infer sensitive characteristics about another person.

On person's page show:

Recent mentions
Related entries
Common themes

# TOPICS

Automatically identify journal topics.

Examples:

Work
Family
Relationships
Health
Money
Projects
Travel
Learning
Goals

Allow users to rename and merge topics.

# MOOD TRACKING

Before or after a journal session optionally ask:

"How are you feeling?"

Use a simple 1-5 scale plus optional label.

Examples:

Very low
Low
Neutral
Good
Great

Mood logging must be optional.

Do not diagnose or interpret mood scores medically.

Insights may show broad patterns such as:

"You've logged more positive days this week."

Avoid claims such as:

"You appear depressed."

# GOALS

Create Goals module.

Goal fields:

id
user_id
title
description
status
target_date nullable
created_from_entry_id nullable
created_at
updated_at

Statuses:

active
paused
completed
archived

Each goal can contain small next actions.

During journal analysis AI may identify potential goals but MUST NOT automatically activate a goal.

Instead present:

"I noticed a possible goal: Finish the onboarding flow."

Buttons:

Add Goal
Ignore

Goal detail page:

description
progress
journal mentions
check-ins
next actions

# WEEKLY REFLECTION

Generate weekly report from the user's journal activity.

Sections:

Your Week

Key Themes

Wins

Challenges

Recurring Patterns

Important Decisions

Goals & Progress

Something Worth Noticing

Next Week

The tone should be observational rather than authoritative.

Use phrases like:

"You mentioned..."

"A pattern that appeared several times..."

"You seemed to place more attention on..."

Avoid statements implying psychological diagnosis.

Weekly reports should be stored so users can revisit them.

# INSIGHTS SCREEN

Cards:

This Week
Mood
Topics
Goals
People
Patterns

Include simple charts only where genuinely useful.

Possible visualizations:

journal frequency
mood trend
most discussed topics
goal activity

Keep visualization minimal.

# AI REFLECTION BEHAVIOR

Create server-side system instructions for the journal companion.

The companion should:

- listen first
- be concise
- ask one question at a time
- avoid repetitive validation
- identify useful connections
- encourage user agency
- distinguish observations from assumptions
- never pretend certainty about motives
- not diagnose
- not prescribe medication
- not tell users what major life decision they must make
- help users explore alternatives
- surface previous relevant journal context carefully

Example behavior:

User:
"I keep delaying my app."

Better response:
"You've mentioned uncertainty about where to start in a few previous entries. Is today's delay mostly about not knowing the next step, or is something else getting in the way?"

Avoid:
"You procrastinate because you have anxiety."

# DATABASE SCHEMA

Create migrations for these tables:

profiles

Fields:
id UUID primary key references auth.users
first_name
display_name
onboarding_complete boolean
preferred_interaction
reflection_style
memory_enabled boolean default true
timezone
created_at
updated_at

journal_sessions

id UUID
user_id UUID
session_type text
started_at
ended_at
status
created_at

Session types:
text
voice

messages

id UUID
user_id UUID
session_id UUID
role
content
created_at

Roles:
user
assistant
system

journal_entries

id UUID
user_id UUID
session_id UUID nullable
title
summary
narrative
mood_score nullable
mood_label nullable
started_at
completed_at
created_at
updated_at

memories

id UUID
user_id UUID
journal_entry_id UUID nullable
memory_type
content
importance_score numeric
confidence_score numeric
embedding vector
created_at
updated_at
last_referenced_at

topics

id UUID
user_id UUID
name
created_at

entry_topics

entry_id UUID
topic_id UUID

people

id UUID
user_id UUID
display_name
relationship_label nullable
notes nullable
created_at
updated_at

entry_people

entry_id UUID
person_id UUID

goals

id UUID
user_id UUID
title
description
status
target_date nullable
created_from_entry_id UUID nullable
created_at
updated_at

goal_checkins

id UUID
user_id UUID
goal_id UUID
content
progress_value nullable
created_at

mood_events

id UUID
user_id UUID
journal_entry_id UUID nullable
score integer
label nullable
notes nullable
created_at

weekly_reports

id UUID
user_id UUID
week_start
week_end
summary
themes jsonb
wins jsonb
challenges jsonb
patterns jsonb
decisions jsonb
goal_progress jsonb
next_week jsonb
created_at

user_preferences

id UUID
user_id UUID unique
voice_enabled boolean
voice_name nullable
auto_play_responses boolean
weekly_report_enabled boolean
reflection_reminders_enabled boolean
created_at
updated_at

Use foreign keys properly.

Use indexes on:

user_id
created_at
journal_entry_id
session_id
goal_id

Add vector similarity index where appropriate.

# ROW LEVEL SECURITY

Enable RLS on EVERY user-owned table.

Policies must enforce:

auth.uid() = user_id

for SELECT, INSERT, UPDATE, and DELETE as appropriate.

Users must NEVER access another user's:

journal entries
messages
memories
people
goals
moods
reports
topics
preferences

Do not rely on frontend filtering for security.

# EDGE FUNCTIONS

Create clean backend functions for:

journal-chat

Receives:
session_id
latest_message

Retrieves:
relevant memories

Calls AI and returns response.

finish-journal-session

Processes completed transcript and produces:

title
summary
narrative
themes
people
emotions
goals
decisions
wins
concerns
memory candidates

embed-memory

Generates embedding and stores it securely.

ask-journal

Performs semantic retrieval and generates a grounded answer.

generate-weekly-report

Aggregates week's entries and generates weekly reflection.

realtime-session

Securely creates/retrieves the necessary realtime session credentials/configuration without exposing permanent provider secrets.

# STRUCTURED AI OUTPUTS

For extraction tasks, request structured JSON and validate it.

Example:

{
"title": "",
"summary": "",
"narrative": "",
"topics": [],
"people": [],
"emotions": [],
"decisions": [],
"wins": [],
"concerns": [],
"memory_candidates": [
{
"type": "",
"content": "",
"importance": 0,
"confidence": 0
}
],
"goal_candidates": [
{
"title": "",
"description": "",
"next_action": ""
}
]
}

Validate server-side before saving.

Never trust arbitrary AI JSON.

# PRIVACY

Build a Privacy section in Settings.

Allow user to:

Export journal
Delete individual entries
Delete memories
Delete all journal data
Delete account

Account deletion must require confirmation.

Provide clear separation between:

Delete memories
Delete journal history
Delete account

Do not use journal data for advertising.

Do not display journal content in analytics events.

# SAFETY BEHAVIOR

The product is for reflection, not emergency care.

If users express immediate intent to seriously harm themselves or another person:

Do not continue ordinary journaling as though nothing happened.

Provide a brief supportive safety response encouraging immediate human help and emergency/crisis resources appropriate to the user's region when known.

Do not attempt to perform diagnosis.

Do not provide instructions that facilitate self-harm.

Keep safety implementation isolated in a server-side moderation/safety layer rather than scattering logic through UI components.

# SETTINGS

Sections:

Profile

Reflection preferences

Voice

Memory

Privacy & Data

Notifications

Appearance

Account

# PWA

Make app installable.

Include:

manifest
icons placeholders
service worker if appropriate
mobile viewport
safe-area support

It should feel excellent when installed on:

iPhone
Android
desktop browser

# RESPONSIVE DESIGN

Prioritize:

375px mobile
430px large mobile
768px tablet
1440px desktop

Do not simply shrink desktop layouts.

Create intentional mobile layouts.

# EMPTY STATES

Design useful empty states.

Examples:

No journal entries:
"Your journal starts with one thought."

No goals:
"When something you want to work toward appears in a reflection, you can turn it into a goal."

No insights:
"Insights become more useful as your journal grows."

# LOADING AND ERROR STATES

Every network feature needs:

loading state
error state
retry path

Voice mode must handle:

microphone denied
connection failed
session timeout
network loss
unsupported browser

Never leave users on a blank screen.

# ACCESSIBILITY

Implement:

semantic HTML
keyboard navigation
focus indicators
ARIA labels
reduced motion support
sufficient color contrast
screen-reader-friendly controls

# CODE QUALITY

Use:

small focused components
typed interfaces
clear service boundaries
reusable hooks
no giant page components
no duplicated API logic

Separate:

UI
data access
AI services
memory retrieval
voice services

Avoid unnecessary libraries.

# SECURITY

Never expose:

OpenAI API keys
Supabase service role key
other provider secrets

Use environment variables and backend functions.

Validate authenticated user identity inside Edge Functions.

Never accept a user_id from the browser as authorization.

Derive user identity from the authenticated session.

Validate and sanitize inputs.

Rate-limit expensive AI endpoints where practical.

# COST CONTROL

Design AI usage economically.

Do not send entire journal history on each request.

Use:

recent conversation context
semantic retrieval
short structured memory records
summaries

Use cheaper models for:

classification
topic extraction
memory extraction

Reserve higher-capability models for:

deep reflection
Ask My Journal
weekly summaries

Place model names/configuration behind environment variables or a central configuration file so they can be changed without rewriting the application.

# DEMO DATA

Provide optional development/demo seed data only.

Never automatically inject demo journal data into a real user's account.

# TESTING

Add tests for critical logic.

At minimum test:

authentication-required routes

RLS assumptions

memory retrieval does not cross users

journal extraction schema validation

goal candidate handling

journal search

empty states

voice fallback states

Ask My Journal with no supporting memories

# ACCEPTANCE TESTS

The MVP is successful when:

1. New user can register.
2. User completes onboarding.
3. User can start a text journal.
4. AI responds conversationally.
5. Conversation persists.
6. User can finish the session.
7. Session becomes a journal entry.
8. AI generates a summary.
9. Important memories are extracted.
10. Memories receive embeddings.
11. A later conversation can retrieve relevant prior memories.
12. User can search journal history.
13. User can ask a question across journal history.
14. AI answer references relevant past entries.
15. User can create and update goals.
16. Weekly reflection can be generated.
17. User can delete a memory.
18. User can delete a journal entry.
19. RLS prevents access to another user's content.
20. Voice UI functions with either realtime mode or an explicitly labeled fallback.

# BUILD ORDER

Do not try to implement everything simultaneously.

Build in this order:

PHASE 1
App shell
design system
authentication
onboarding
database schema
RLS

PHASE 2
Text journaling
journal sessions
messages
journal history

PHASE 3
AI journal chat
finish-session analysis
structured extraction

PHASE 4
Memory extraction
embeddings
pgvector retrieval

PHASE 5
Ask My Journal

PHASE 6
Goals
topics
people
mood

PHASE 7
Weekly reports
insights dashboard

PHASE 8
Realtime voice architecture and fallback

PHASE 9
Privacy controls
data deletion/export
settings

PHASE 10
PWA polish
responsive QA
accessibility
security testing

Do not claim a feature works unless it is implemented and verified.

When an external API credential or manual configuration is required, stop at the correct integration point and clearly tell me exactly what credential/configuration is needed.

Do not silently mock external services in production paths.

# IMPORTANT DEVELOPMENT RULE

Before major implementation:

1. create or update AGENTS.md
2. create PROJECT-SPEC.md
3. document architecture
4. document database schema
5. document environment variables
6. document test requirements

Keep these files updated as implementation evolves.

# FINAL BUILD STANDARD

I want a real maintainable SaaS foundation, not a visual prototype.

Prioritize:

security
privacy
data ownership
long-term maintainability
clean architecture
mobile usability
AI cost control
reliable memory retrieval

Start by creating Phase 1 and the database foundation.

Then continue through the phases sequentially, verifying each phase before moving to the next.

Do not copy the appearance, wording, branding, proprietary prompts, or copyrighted assets of Rosebud.

Create an original product named Reflective.
- Long-term memory lives in `src/lib/ai/memory.server.ts` (filter thresholds in `MEMORY`, `EMBEDDING_MODEL` env, default google/gemini-embedding-2 at 3072 dims stored as `memories.embedding_v halfvec(3072)` with HNSW cosine); vector search only via `match_memories` RPC (SECURITY INVOKER, hard-scoped to auth.uid()), called with the user's JWT client so RLS always applies.
- Memory work never blocks journaling: saving runs after the entry is stored, retrieval failures return [] and chat continues, failed embeddings stay as `embedding_status='failed'` and are retried.
- Ask My Journal lives in `src/lib/ai/ask.server.ts`, exposed via `src/lib/ask.functions.ts`: one query embedding → `match_memories` + `match_entries` (entry summaries embedded into `journal_entries.summary_embedding` after analysis, SECURITY INVOKER, auth.uid()-scoped, optional date range parsed server-side in UTC) → `ASK_JOURNAL_MODEL` answer; related entries are only ids the server retrieved (model cites E1..En refs), never model-supplied ids.
- Goals/topics/people/mood browser data access lives in `src/lib/tracking.ts` (RLS-scoped); entries link via `entry_topics`/`entry_people` (session_* join tables deprecated), created deterministically from stored analysis by `src/lib/ai/tags.server.ts` — no extra AI calls. Merges run in `merge_topics`/`merge_people` SQL functions (invoker rights, ownership-checked, atomic). People dedupe only on exact cleaned names (`src/lib/tags.ts`); never fuzzy-merge.
- Weekly reflections: `src/lib/ai/weekly.server.ts` via `src/lib/weekly.functions.ts` (stands in for generate-weekly-report); pure week math + `validateWeekly` in `src/lib/weekly.ts`. One row per user/week (unique), regenerate upserts in place; evidence is stored summaries/analysis only, refs E#/G# mapped server-side. `WEEKLY_REPORT_MODEL` in config.server.ts. Insights numbers are deterministic browser reads in `src/lib/reports.ts` — never AI on page open. Weeks start Monday in `profiles.timezone` (set from the browser on first generate, else UTC).
