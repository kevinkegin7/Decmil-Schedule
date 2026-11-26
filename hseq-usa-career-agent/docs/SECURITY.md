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
