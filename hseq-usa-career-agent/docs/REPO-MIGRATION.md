# Repository migration plan: move to a dedicated private repository

**Status: prepared and dry-run tested. Not executed.** Nothing is merged,
deleted or pushed elsewhere until you approve.

## Constraints (from your instructions)

- The new repository is **private**, under **your personal GitHub account**.
- Branch `claude/vigilant-faraday-8wt1yx` and PR #4 in `Decmil-Schedule` stay
  untouched until you have verified the new repository.
- The Decmil Take 5 code is not modified, deleted or copied.
- No Decmil confidential information, proprietary code or employer-owned
  material goes into the new repository.

## What moves

Only `hseq-usa-career-agent/` (formerly `hseq-career-agent/`), with its
history rewritten so that folder becomes the repository root.

**Dry-run result (2026-11-26):**
- 2 commits (Milestone 0, Milestone 1) — Milestone 2 will make it 3.
- 116 files, all inside the project.
- **Zero** Decmil Take 5 files anywhere in history (`take5.js`, `current-system/`,
  `index.html`, the compliance zip, test harness) — checked by the script.
- No `.env` files or key material in any commit — checked by the script.

**Mentions of "Decmil" that remain**, all non-proprietary:
- your own employment fact (current employer "Decmil", role "HSE Advisor") in
  the starter profile function and as test data;
- the decision log (ADR-001) noting that the project began inside a repository
  holding the Decmil Take 5 tool;
- the M0/M1 commit messages saying the Take 5 code was left unchanged.

None of these contain Decmil code, documents, client or project details. If
you prefer, ADR-001 can be reworded and the starter-profile employer replaced
by a placeholder before the move. Say so and I'll do it in a commit first.

## Steps

| # | Who | Action |
|---|---|---|
| 1 | You | Create an **empty private** repository under your account, e.g. `hseq-usa-career-agent`. No README, licence or .gitignore. |
| 2 | You | Approve the migration. |
| 3 | Me (or you) | From the `Decmil-Schedule` root: `bash hseq-usa-career-agent/scripts/export-to-private-repo.sh` (dry run), check the summary, then `… --push <new repo URL>`. The script works in a temporary clone and never changes `Decmil-Schedule`. *To let me push, add the new repository to this Claude session (it then appears in my allowed repositories).* |
| 4 | Me | Open the same three milestones as the history of `main` in the new repo; add CI (lint, typecheck, unit tests; integration and E2E with the Supabase CLI in GitHub Actions). |
| 5 | You | Verify: clone, `npm ci`, `npx supabase start`, `npm run test:all`. |
| 6 | You | Move deployment and secrets (below). |
| 7 | You decide | Only after step 5: close PR #4 **without merging** and delete the branch, or keep them as an archive. Nothing in `Decmil-Schedule` changes otherwise. |

**History preservation:** `git filter-repo` keeps every commit that touched the
project, with original authors, dates and messages; only paths are rewritten.
Commit hashes change (unavoidable when paths change). PR #4 remains the record
of the original hashes.

## Environment variables and secrets

Nothing secret is in the repository. These live in your accounts:

| Variable | Where it goes | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel project env (Production + Preview), local `.env.local` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same | Public; protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Local `.env.local` only** for scripts (`user:create`, `import:lca`, `verify:sources`); GitHub Actions secret only if CI ever needs it against a test project | Never in Vercel for the app; never `NEXT_PUBLIC_` |
| Supabase access token / DB password (for `supabase link`, `db push`) | Your machine (`supabase login`) or a GitHub Actions secret if you automate migrations | Never committed |

Rotate the Supabase keys after the move if you have ever pasted them anywhere
else.

## Deployment configuration

- **Supabase:** unchanged. The project is not tied to a repository. From the
  new repo: `npx supabase link --project-ref <ref>` then `npx supabase db push`
  (applies Milestones 1 and 2).
- **Vercel:** import the new repository as a new project (root directory `/`,
  not `hseq-usa-career-agent/`), add the two public env vars, deploy. Add the
  Vercel URL to Supabase Auth → URL configuration.
- **GitHub:** private visibility; branch protection on `main`; Dependabot
  alerts on.

## Rollback

The original branch and PR remain until you remove them. If anything is wrong
with the new repository, delete it and re-run the script. The source is never
changed.
