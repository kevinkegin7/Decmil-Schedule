# Security — Milestone 1

## Controls

| Requirement | How it is met | Proven by |
|---|---|---|
| Users access only their own records | RLS on every user table: separate select/insert/update(/delete) policies on `user_id = auth.uid()` (`id` for profiles). Anonymous role has no grants. | Integration §6: a second user gets empty results, 0-row updates and deletes, and `42501` on inserts under another id. A mutation check (RLS switched off) makes these tests fail. |
| Inserts only with the user's own id | RLS `WITH CHECK` | Integration §6 |
| Audit records cannot be edited or deleted | SELECT-only grant + UPDATE/DELETE/TRUNCATE-blocking trigger + per-user SHA-256 hash chain | Integration §7 (insert, update, delete all rejected; chain verifies) |
| Evidence stored privately | Private bucket, MIME and size limits, owner-folder policies, 60-second signed URLs, path CHECK on the table | Integration §4 and §6: public URL fails; a second user cannot download, sign, list or overwrite; HTML upload rejected |
| Service-role key stays server-side | Not read anywhere in `src/` (scripts and tests only). App uses the anon key + user JWT. `server-only` guards server modules. `scripts/check-secrets.mjs` scans the client bundle and tracked files. | `npm run check:secrets` (also proven to fail on a planted key) |
| No secrets committed | `.env*` git-ignored except `.env.example`; scanner checks tracked files | `check:secrets` |
| Qualifications never auto-verified | DB trigger forces `unverified` on insert, resets on edit, requires review first; explicit confirm dialog in the UI | Integration §4, "profile safeguards" |
| No invented data | Starter profile contains only owner-supplied facts, with no dates or numbers; everything flagged for review; profile cannot be marked complete until reviewed | Integration "starter profile" test |
| External communications off | No email code. `external_comms_enabled` locked `false` by CHECK. | Integration "external communications" test |
| Emergency pause | `user_controls` pause flags, Settings control, header indicator (enforced by agents and dispatch from later milestones) | Integration pause test |

## Authentication

- Supabase Auth with email and password. **Public sign-up disabled**; accounts
  are created with `npm run user:create`.
- Passwords: minimum 12 characters, with lower case, upper case and digits (Auth config).
- Sessions are httpOnly cookies managed by `@supabase/ssr`. `proxy.ts`
  refreshes them, and `requireUser()` re-verifies with the Auth server
  (`getUser()`, not just the cookie) in every page and Server Action.
- Login errors are generic ("Incorrect email or password."). Supabase Auth
  rate-limits sign-in attempts.
- Post-login redirect accepts only `/dashboard…` paths (no open redirect).
- Sign-in and sign-out are recorded in the audit log.

## Application hardening

- Every Server Action re-validates input with Zod on the server and maps database errors to safe messages.
- Security headers on all routes: `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS; `X-Powered-By` removed.
- `robots: noindex`.
- No personal data in caches: all user data renders at request time.

## Known gaps and decisions (tracked)

| Item | Status |
|---|---|
| **Multi-factor authentication** (TOTP) | Deferred. Planned before any email sending is enabled; approvals will then require MFA (`aal2`). See ADR-012. |
| Full script-src CSP with nonces | Not yet; only the framing, base and form restrictions are set. Revisit at deployment. |
| Postgres superuser can bypass triggers | Inherent. The app never uses that credential; the audit hash chain detects edits afterwards. |
| Audit log stores row diffs including short personal fields (names, employers) | Accepted: it is the owner's own data, visible only to them. Long narrative text is hashed. |

## Reporting

Single-user private system. If a credential is exposed, rotate it in the
Supabase dashboard (API keys, JWT secret) and review the audit log.

---

# Milestone 2 controls

| Requirement | How it is met | Proven by |
|---|---|---|
| No external actions | No code path sends email, contacts anyone, submits applications or makes representations. The only outbound requests are read-only GETs to public job-board APIs. The UI has no such buttons; external links open the employer's own pages. `external_comms_enabled` still locked. | E2E `expectNoExternalActions` on employer and job pages; integration "external communications remain locked" |
| Only permitted sources | Public, documented APIs and official government files; careers pages are link-only; descriptive User-Agent; 15 s timeout; one request per refresh | Unit tests on adapters (exact URLs, single GET); `docs/DATA-SOURCES.md` |
| RLS on all new tables | Owner policies; shared reference tables read-only; anonymous gets nothing | Integration "RLS on Milestone 2 tables"; mutation check (RLS off on `employers` → tests fail) |
| No cross-user linking | `fn_assert_same_owner` trigger | Integration: Bob cannot attach evidence or saves to Alice's employer |
| Honest sponsorship labels | Generated `category`; historical never "confirmed"; conflicts and staleness flagged | Unit + integration tests |
| Sample data identifiable | `is_sample`, `Sample —` names, example.com URLs, `sample` source, badge everywhere, one-click removal | Unit, integration and E2E tests |
| Agent recommendations audited | `job_matches`, `pathway_assessments`, `agent_runs` audited; `app.agent.*` events | Integration "audit of agent recommendations" (chain verifies) |
| Untrusted external text | Posting HTML is converted to text (scripts and tags stripped) and rendered as text, never as HTML. Links use `rel="noopener noreferrer"`. | Unit `htmlToText` test |
| Service-role key | Used only by CLI scripts (`import:lca`, `verify:sources`, `user:create`), never by `src/` | `check:secrets` |
