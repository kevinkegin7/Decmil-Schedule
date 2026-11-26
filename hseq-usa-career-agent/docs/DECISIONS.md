# Architecture Decision Records

Short records of decisions and why. New decisions are appended; superseded ones
are marked, not deleted.

---

## ADR-001 — Project lives in `hseq-usa-career-agent/` inside this repository
**Status:** accepted (provisional) · 2026-11-26

This repository holds the unrelated Decmil Take 5 compliance tool. The session
can only push to this repository, so the platform is a self-contained subfolder
with its own `package.json` (from M1) and no shared code. **Recommended:** move it to its
own private repository before Milestone 2, when real CV data starts flowing,
so access control and CI are separate from the Decmil code.

## ADR-002 — Agents run on the Messages API with code orchestration
**Status:** accepted · 2026-11-26

Options: (a) Messages API + tool use, with our own loop; (b) Claude Managed
Agents (Anthropic-hosted loop and sandbox, beta); (c) Claude Agent SDK.

Chosen: **(a)**. Every agent action that matters is a database write that must
pass our own approval, rate-limit and audit layer, and the agents' tools are our
own typed DB functions. We need no hosted sandbox or filesystem. Keeping the loop
in our code makes each step testable and lets the kill switch be checked between
tool calls. Managed Agents remains a reasonable option for the long-running
research agents (Employer and Immigration Intelligence) if run times outgrow our
worker. It would still have to write through the same `agent_worker` role.

## ADR-003 — Safeguards are enforced in Postgres, not only in app code
**Status:** accepted · 2026-11-26

Approvals, send gating, rate limits, verification, kill switches and audit live
in triggers and grants. App bugs, a compromised agent prompt or a mis-wired
route cannot bypass them; they fail closed. The cost is more complex SQL, which
is covered by a dedicated SQL test suite.

## ADR-004 — Every outbound message needs approval in v1
**Status:** amended by ADR-013 · 2026-11-26

The brief requires approval for initial outreach. Replies and follow-ups can also
carry commitments (salary, availability, sponsorship statements), and
classifying "low-risk" reliably is unproven. v1 therefore requires approval for
**all** outbound mail. Auto-sending a narrow class (for example
interview-time confirmations) can be revisited after Milestone 10, with data.

## ADR-005 — No guessed email addresses; no LinkedIn scraping
**Status:** accepted · 2026-11-26

Only addresses published for recruiting (job posting, company site, directory),
supplied by the user, or received in correspondence are stored, with source URL.
Guessed addresses raise bounce and spam-complaint rates, damage the user's sender
reputation and look like cold marketing. LinkedIn's terms forbid scraping; the
user can paste contacts in manually.

## ADR-006 — Single-tenant service roles
**Status:** accepted · 2026-11-26

`agent_worker` and `dispatcher` RLS policies allow access across users, because
the deployment serves one person. If the platform ever serves more users, the
worker JWT must carry a `sub` and the policies change to `user_id = auth.uid()`.
This is called out in the migration.

## ADR-007 — One model, effort tuned per agent
**Status:** accepted · 2026-11-26

All agents default to `claude-opus-5-5`, with `output_config.effort` set per
agent (low for classification, high for drafting and immigration research). One
model keeps behaviour consistent and keeps one prompt-cache namespace. The model
ID is per-agent config, so a cheaper model can be tried on a route (for example
inbound classification) once an evaluation set exists and shows quality holds.

## ADR-008 — Add the E-3 visa to the pathways
**Status:** accepted with classification — see ADR-018 · 2026-11-26

The brief lists EB-2, EB-2 NIW, EB-3, H-1B and L-1. The **E-3** is a
specialty-occupation visa available only to Australian citizens. It has its own
annual allocation outside the H-1B lottery, uses the same LCA process, and is
renewable. For an Australian HSEQ professional with a relevant bachelor's degree
it is often the most practical first pathway. Whether a given HSEQ role counts as
a specialty occupation is a legal question for an attorney. The schema already
includes `e3`, and DOL disclosure data records E-3 filings separately, so
historical E-3 use by employers is visible.

## ADR-009 — Postgres-backed task queue
**Status:** accepted · 2026-11-26

`agent_tasks` + `claim_agent_task()` (`FOR UPDATE SKIP LOCKED`) instead of an
external queue. The volume is small (tens of tasks a day), it is transactional
with the rest of the data, and the pause check lives in the claim function.
Revisit if volume grows.

## ADR-010 — Audit log hashes bodies instead of copying them
**Status:** accepted · 2026-11-26

A "complete" audit log that copied every email body would become a second,
long-lived store of personal data. Diffs are stored in full, except
`body_text`, `description` and token ciphertext, which are replaced by SHA-256
hashes. This still proves what was approved and sent (it matches the content
hash) without duplicating the content.

---

## ADR-011 — Follow Next.js 16 conventions: `proxy.ts`, Cache Components
**Status:** accepted · Milestone 1

The brief's layout lists `src/middleware.ts`. Next.js 16 deprecates it in
favour of `src/proxy.ts`, with identical behaviour, so the app uses `proxy.ts`.
The scaffold enables Cache Components. Pages are therefore a static shell, with
session-reading content behind `<Suspense>` (which also provides the loading
states). `createClient()` calls `connection()`, so personal data is always
rendered per request and never cached.

## ADR-012 — MFA deferred to the email milestone
**Status:** accepted · Milestone 1

The Milestone 0 roadmap put TOTP MFA in Milestone 1. The Milestone 1 brief
doesn't require it, and nothing outward-facing exists yet. Sign-in is email and
password with sign-up disabled and a 12-character policy. MFA, plus `aal2` for
approvals, becomes a precondition of enabling email (Milestone 4).

## ADR-013 — Email autonomy: approval first, limited routine follow-ups later
**Status:** accepted · Milestone 1 (amends ADR-004)

The owner chose `approval_then_limited_followups`. Initial outreach always needs
approval. A narrow class of routine follow-ups may later be sent automatically,
within the database rate limits in the target design (at most 2–3 follow-ups,
at least 3–5 days apart, stopped by any reply). This needs its own sign-off when
email is enabled. The setting is stored and editable now; nothing acts on it in
Milestone 1.

## ADR-014 — Milestone 1 tables follow the brief; target schema kept as design
**Status:** accepted · Milestone 1

The Milestone 1 brief specifies exact table and field names (`profiles`,
`career_profiles`, `audit_logs` with uuid ids, …). These supersede the
equivalent Milestone 0 tables. The Milestone 0 schema (outreach, approvals, send
gate) moves to `docs/design/` and will be added in later milestones as new
migrations. Additions beyond the brief, each for a safeguard: `needs_review`
flags, `verified_at`, audit `seq`/`prev_hash`/`hash`, `user_controls`,
`salary_basis_note`.

## ADR-015 — Starter profile from owner-supplied facts only
**Status:** accepted · Milestone 1

`load_starter_profile()` holds only what the owner stated (Decmil, HSE Advisor,
Curtin Occupational Safety and Health degree, NEBOSH and ICAM credentials, the
industries). Exact titles are marked "confirm exact title". There are no dates,
numbers, memberships or achievements. Every record is flagged for review, every
qualification is unverified, and the profile can't be marked complete until
each is reviewed. The same function backs the local seed and the dashboard's
"Load starter profile" button.

## ADR-016 — shadcn/ui-style components written in-repo
**Status:** accepted · Milestone 1

The shadcn registry (`ui.shadcn.com`) was not reachable from the build
environment. shadcn components are copied source by design, so the needed
primitives were written in `src/components/ui` on the same packages (`radix-ui`,
`class-variance-authority`, `tailwind-merge`). `npx shadcn add` can still be
used later where the registry is reachable.

## ADR-017 — Tests run against a real local Supabase stack
**Status:** accepted · Milestone 1

Integration and E2E tests use the Supabase CLI's Docker stack, not mocks, so
RLS, storage policies, triggers and Auth are exercised for real. Test helpers
refuse to run against a non-local URL, because they create and delete users.

---

## ADR-018 — E-3 tracked as currently ineligible
**Status:** accepted · Milestone 2 (owner decision)

The owner holds a non-Australian passport. E-3 requires Australian citizenship,
and an Australian 485 visa or permanent residency does not qualify. E-3 is
tracked and classified `currently_ineligible — Australian citizenship
required`, to be reconsidered if citizenship is acquired. The rule reads the
recorded citizenships, so it updates automatically if that changes. The owner's
citizenship is stored in `immigration_profiles` (private, RLS) and loaded by
`load_starter_immigration_profile()`. Country of birth, which decides
green-card chargeability, is not assumed.

## ADR-019 — Deterministic "agents" in Milestone 2; no LLM yet
**Status:** accepted · Milestone 2

Ranking, sponsorship classification and pathway assessment are rule-based and
recorded as `agent_runs`. Every output is reproducible, explainable line by
line, and testable, which matters for decisions about visas and pay. A
Claude-assisted step (for example reading unusual posting wording) can be added
later as a separate, labelled input, never as a silent override.

## ADR-020 — Job sources: public job-board APIs only; careers pages link-only
**Status:** accepted · Milestone 2

Greenhouse, Lever and Ashby publish read-only APIs intended for showing an
employer's jobs. Those are used; arbitrary careers pages are not scraped. Workday
and similar systems without a public API are handled by linking to the
official page and recording statements manually.

## ADR-021 — Personal-scale data: filter in TypeScript
**Status:** accepted · Milestone 2

Lists load once per table and are filtered, sorted and classified in tested
TypeScript, which keeps classification logic in one place. Move filtering into
SQL views if volumes exceed a few thousand rows.

## ADR-022 — Repository separation prepared, not executed
**Status:** accepted · Milestone 2 (execution awaits owner approval)

`scripts/export-to-private-repo.sh` extracts the project with history into a
standalone repo, refusing to continue if any Decmil Take 5 file or secret is
found. PR #4 and its branch stay until the new repository is verified. See
`docs/REPO-MIGRATION.md`.
