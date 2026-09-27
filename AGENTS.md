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
- Shared signed-in chrome lives in `src/components/app-shell.tsx` (bottom tabs on mobile, side rail on desktop).
