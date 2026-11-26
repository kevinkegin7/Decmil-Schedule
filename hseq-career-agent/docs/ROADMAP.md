# Development Roadmap

Each milestone ends with a **gate**: a short demo, passing tests and the user's
sign-off before the next one starts. **No message leaves the platform before
Gate 8.**

| # | Milestone | Main deliverables | Tests | Gate |
|---|---|---|---|---|
| **M0** | Architecture & schema ✅ | `ARCHITECTURE.md`, `SAFEGUARDS.md`, `DECISIONS.md`, this roadmap; migration `0001` with DB-level safeguards | SQL safeguard suite (49 checks) passes | **User approves architecture, schema, ADR-008 (E-3), ADR-001 (repo location)** |
| **M1** | Foundation & secure auth | Next.js + TypeScript scaffold; Supabase project (Sydney); Auth with Google/Microsoft/email; **mandatory TOTP MFA**, approvals require `aal2`; typed per-role clients; app shell, mobile navigation, **always-visible pause button**; CI (lint, typecheck, vitest, SQL suite) | Auth E2E; RLS cross-user test; pause button E2E | Login + MFA + pause demo |
| **M2** | Career profile (Career Director) | CV upload to a private bucket; Claude CV parser → **unverified** facts; verification UI (fact by fact, attach evidence); preferences; disclosure levels; `buildAgentContext()` | Parser output schema tests; "agent cannot verify" test; context builder drops private facts | User verifies their real profile |
| **M3** | Employer discovery (Employer Intelligence) | Employer and job model UI; Greenhouse/Lever/Ashby public job APIs; web search discovery for target industries and states; dedupe; fit scoring with rationale; employer database and job pages | Fixture-based ATS adapter tests; dedupe tests; fit-score schema tests | Review first 25 employers and 50 jobs for quality |
| **M4** | Sponsorship evidence | Ops import of DOL OFLC LCA/PERM disclosure files (HSEQ SOC filter); FEIN/name matching to employers; posting-statement extraction; `v_employer_sponsorship` in the UI with honest labels | Matching precision tests on fixtures; "historical ≠ willing" UI test | Spot-check 10 employers against source data |
| **M5** | Immigration intelligence | Pathway assessments (E-3, H-1B, L-1, EB-2, EB-2 NIW, EB-3) with citations from government domains only; source freshness re-check; immigration tracker page; attorney-review fields; "not legal advice" banners | Every assessment cites ≥1 source (DB + unit); domain allow-list test | User reviews assessments; optionally with an attorney |
| **M6** | Outreach drafting & approval workflow | Contact capture (published sources only); Outreach agent drafts with fact citations; **claim checker**; fixed work-authorisation sentence; approval screen (exact content, recipients, citations, rate-limit preview); edit → re-approve | Claim checker red-team set (invented degree, implied work rights, confidential client name); approval hash E2E | User approves a batch of drafts (**nothing is sent**) |
| **M7** | Mail connection, read-only (Email Negotiator) | Gmail + Graph OAuth with **read scopes only**; encrypted tokens; filtered thread sync; classification; reply drafts; follow-up scheduling (drafts only); email centre page | Provider adapters against recorded fixtures; prompt-injection test set; auto-suppress on unsubscribe | User reviews classifications on real mail |
| **M8** | External communications enablement | Request send scopes; dispatcher with reconciliation; send windows; opt-out line; bounce handling; daily digest. Operator flips the platform switch only after sign-off; the user flips their own | Send gate tests (all 10 safeguard categories); dispatcher crash/reconcile test; sandbox send to the user's own address | **Explicit user approval to enable sending**, then a 1-message-per-day pilot for a week |
| **M9** | Applications, interviews, offers (Application Manager) | Application tracker; interview scheduling and prep notes; offer capture and comparison (incl. sponsorship terms); binding-action confirmation dialogs; action items | Binding status guard E2E; offer approval flow | User walks through a mock offer |
| **M10** | Dashboard, activity & hardening | Overview page; agent activity (runs, cost, blocked sends, audit view); nightly audit-chain check; security review; load of rate limits; backup/restore drill; runbook | Full E2E suite; security review findings closed | Production go-live |

## Working method

- One milestone per pull request (or a small stack), each with its tests and a
  short decision note in `DECISIONS.md` where something was chosen.
- Schema changes are new numbered migrations; the SQL safeguard suite grows with
  them and must stay green.
- Real personal data (CV, mail) enters only from M2/M7, after the user confirms
  the repository location (ADR-001).
- Costs: each milestone reports Claude API spend from `agent_runs` so effort
  levels can be tuned with data.

## Decisions needed from the user before M1

1. Approve the architecture, schema and safeguard design.
2. Confirm adding **E-3** as a tracked pathway (ADR-008).
3. Keep the project in this repository, or move it to a new private repository (ADR-001).
4. Mail provider(s) to support first: Gmail, Microsoft 365, or both.
5. Target US states and any employers to exclude (for example a current
   employer's US affiliates).
