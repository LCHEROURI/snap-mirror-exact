# Repair plan: five verified issues

No code changes until approved. Each issue lists files, migration, tests, risk, and sequence.

## 1. Usage-limit bypass (users can delete their own usage rows)

Confirmed: migration 0009 grants `DELETE` on `ai_usage` to signed-in users and adds an "own usage delete" policy. `consume_ai_quota` runs with the caller's rights, so it needs those grants. Anyone can clear their own counter and skip the limit. The same is true for `INSERT`, which is harmless but not needed.

- **Files:** new migration `drizzle/migrations/0011_lock_ai_usage.sql`; `AGENTS.md` (one-line rule); `PROJECT-SPEC.md` (security notes).
- **Migration:** yes.
  - Rebuild `consume_ai_quota` as SECURITY DEFINER with `search_path = public`. It still reads `auth.uid()`, returns an error when that is empty, and keeps the advisory lock and the 2-day cleanup. Add limits on the inputs: `p_limit` from 1 to 1000, `p_window_seconds` from 1 to 86400, and `p_kind` checked against the known kinds.
  - `REVOKE INSERT, DELETE ON public.ai_usage FROM authenticated`. Drop the "own usage insert" and "own usage delete" policies. Keep SELECT.
  - `delete_all_personal_data` also runs with the caller's rights and runs `DELETE FROM ai_usage`. That line would fail after the revoke. Move it into a small SECURITY DEFINER helper, `clear_my_ai_usage()`, that only deletes rows where `user_id = auth.uid()`. Only `delete_all_personal_data` calls it, and it is not granted to signed-in users directly. Recreate `delete_all_personal_data` so it calls the helper.
  - `REVOKE EXECUTE ... FROM anon, public` on both functions. `GRANT EXECUTE` on `consume_ai_quota` to authenticated only.
- **Tests:** the security script (issue 5) must show that deleting and inserting your own usage rows fails, the quota still blocks at its limit, deleting all personal data still works, and signed-out callers are still refused. Run the database linter.
- **Risk: medium.** If the function owner or grants are wrong, `allowAi` fails open (it logs and allows), so users are never blocked, but the limiter would silently stop working. Check the logs for `[rate-limit] check failed` after deploying. Dropping policies needs your yes/no because the tool pauses on DROP.
- **Sequence:** write the migration → apply it → run the linter → run the security script → watch the logs.

## 2. Finishing always saves, but analysis must obey its quota

Confirmed: `finishJournalSession` skips `allowAi`, and `finishSession` always calls `analyzeEntry`. Only `retryEntryAnalysis` is limited today.

- **Files:** `src/lib/ai/journal-ai.server.ts`, `src/lib/companion.functions.ts`, the finish handlers in the write/voice screens (`write.$sessionId.tsx`, `use-voice-session.ts`), and `entry-analysis.tsx`, which shows the "analysis pending / retry" state.
- **Migration:** none. The existing `analysis_status` value `'pending'` is reused.
- **Change:**
  1. `finishSession(db, userId, sessionId, { allowAnalysis })` always saves the entry and marks the session completed.
  2. The server function saves first, then calls `allowAi(supabase, "analysis")`:
     - If allowed, it runs `analyzeEntry`.
     - If not, it leaves the entry at `analysis_status='pending'` and returns `{ ok: true, entryId, analysisOk: false, analysisDeferred: true }`.
  3. The entry page already has a retry path through `retryEntryAnalysis`, which is limited. Show "Summary will be ready shortly, tap to generate" when the entry is pending and not failed.
- **Tests:** a unit test with a mocked `allowAi` and a fake db. When allowed, analysis is called. When blocked, the entry is still saved, analysis is not called, and `analysisDeferred` is true. When the limiter errors, it fails open and analysis still runs. Also check once by hand with a lowered test limit.
- **Risk: low to medium.** Screens that treat `analysisOk: false` as "failed" could show the wrong message, so all callers need review. The entry is never at risk because saving happens before the quota check.
- **Sequence:** change the server code → change the server function → update the UI copy → add tests → do the manual check.

## 3. Ask My Journal date ranges use UTC

Confirmed: `parseRange` in `ask.server.ts` builds every boundary with `Date.UTC`. `weekly.ts` already has `safeTimezone` and `localDate`.

- **Files:** `src/lib/ai/ask.server.ts`; a new pure helper in `src/lib/weekly.ts` (or `src/lib/dates.ts`): `zonedMidnight(dateStr, tz) -> Date` (the UTC instant of local midnight); a new test file `src/lib/ai/ask-range.test.ts`.
- **Migration:** none. `profiles.timezone` already exists.
- **Change:** `parseRange(q, tz, now)` computes local "today", Monday, and the first day of the month with `localDate`, then turns each boundary into an instant with `zonedMidnight`, so daylight-saving changes are handled. `askJournal` reads `profiles.timezone` through the user's own RLS-scoped client, falling back to UTC through `safeTimezone`. Move `parseRange` into a file without `.server` so it can be tested. Update the doc comment.
- **Tests:**
  - A time zone ahead of UTC (Asia/Tokyo) near midnight UTC: "today" and "this week" move to the correct local day.
  - A time zone behind UTC (America/New_York) across a daylight-saving change.
  - "last month" in January.
  - An invalid or empty time zone falls back to UTC.
  - Queries with no date phrase still return undefined.
- **Risk: low.** Only questions with date phrases change. Existing UTC users see identical results.
- **Sequence:** add the helper and its tests → refactor `parseRange` → wire in the time zone → run vitest.

## 4. `.env` is tracked

Confirmed: `git ls-files` lists `.env`, and `.gitignore` has no `.env` entry. It only holds the public URL and publishable keys, which are not secret, but the file should not be tracked.

- **Files:** `.gitignore` (add `.env`, `.env.*`, `!.env.example`); new `.env.example` with names and empty or placeholder values; `ENVIRONMENT.md` (point to `.env.example`); `README.md` setup line.
- **Migration:** none.
- **Constraint:** Lovable generates and manages `.env` itself and git is managed internally, so I can't run `git rm --cached` or delete the file. Ignoring it and adding `.env.example` is what I can do. Removing it from history, if you want that, is a step for you in your own GitHub copy. No key rotation is needed: the values are publishable, and the service key was never in the file.
- **Tests:** check that `.env.example` has no real values and that the preview still loads.
- **Risk: low.** Deleting `.env` would break the preview, so it stays in place.
- **Sequence:** update `.gitignore` → add `.env.example` → update the docs.

## 5. Security script: test the bypass and stop hardcoding the key

Confirmed: line 2 of `scripts/security-check.ts` hardcodes the publishable key, and no step tries deleting usage rows.

- **Files:** `scripts/security-check.ts`; `ENVIRONMENT.md` (required variables).
- **Migration:** none.
- **Change:**
  - Read `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from the environment, and exit early with a clear message if any are missing.
  - New checks:
    1. A uses up the quota (limit 3), then deletes its own `ai_usage` rows. The delete must error or affect 0 rows (compare counts before and after through admin), and the 4th call must still return false.
    2. A inserting its own `ai_usage` row must fail.
    3. Calling `consume_ai_quota` with a limit above the cap or an unknown kind must error.
    4. A still cannot touch B's rows (existing check).
    5. `delete_all_personal_data` still succeeds and removes A's usage rows (check through admin).
  - Fix the odd `"user_id" in {}` expression on line 30.
- **Tests:** the script is the test. Run it once before the migration: the new bypass check should FAIL, proving it catches the problem. Run it again after: everything should PASS.
- **Risk: low.** It is a script only. It creates and deletes two temporary accounts, as it does now.
- **Sequence:** update the script → run it before issue 1 is fixed (expect FAIL) → run it after (expect PASS).

## Recommended implementation order

1. Issue 5, script update. Run it now to confirm the bypass fails the check.
2. Issue 1, the migration that locks down usage rows. Run the linter, then the script again (all pass).
3. Issue 2, the analysis quota on finish, with its unit tests.
4. Issue 3, time-zone-aware date ranges, with their unit tests.
5. Issue 4, the `.env` ignore rules, `.env.example` and docs.
6. Final pass: vitest, the security script, the linter, and one real journal finish checked by hand (saved and analysed), then one checked with the quota exhausted (saved, analysis deferred). Update `AGENTS.md` and `PROJECT-SPEC.md`.
