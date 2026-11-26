# Architecture — Milestone 1

What is built now. The full multi-agent target design is in
[`design/TARGET-ARCHITECTURE.md`](design/TARGET-ARCHITECTURE.md).

## Overview

```
Browser ──HTTPS──▶ Next.js 16 (Vercel)
                    ├─ proxy.ts           refresh session cookie; /dashboard → /login if signed out
                    ├─ Server Components  render pages; read data as the signed-in user
                    ├─ Server Actions     requireUser → Zod validate → service → refresh()
                    └─ services/*         all data access (typed supabase-js, RLS applies)
                              │  user JWT + anon key
                              ▼
                    Supabase  ├─ Auth      email + password, sign-up disabled
                              ├─ Postgres  RLS on every table, guard triggers, audit_logs
                              └─ Storage   private bucket "qualification-evidence"
```

The browser talks to Supabase directly in exactly one case: uploading an
evidence file to the private bucket. Storage policies restrict each user to
their own folder. Everything else goes through Server Actions.

## Layers

| Layer | Folder | Rule |
|---|---|---|
| Routes and pages | `src/app` | Pages are a static shell plus an async component behind `<Suspense>` that reads the session (required by Cache Components). No business logic. |
| Server Actions | `src/app/**/actions.ts` | Thin wrappers via `runAction()`: authenticate, validate with the shared Zod schema, call a service, `refresh()`. Never trust client input. |
| Components | `src/components` | Presentation and form state only (React Hook Form + `zodResolver`). |
| Services | `src/services` | Business logic and queries. Take a Supabase client argument, so the same code runs in the app and in integration tests. |
| Validation | `src/lib/validation` | One Zod schema per form, used in the browser and again on the server. |
| Security | `src/lib/security` | `requireUser()` (verifies the session with Supabase Auth on every call), safe error mapping, action wrapper. |
| Database | `supabase/migrations` | Schema, RLS, guard triggers, audit, storage policies. |

## Request flow: saving a form

1. React Hook Form validates in the browser with the Zod schema, for immediate feedback.
2. The Server Action calls `requireUser()`, which calls `supabase.auth.getUser()` and redirects to `/login` if the session is invalid.
3. The same Zod schema validates again on the server; field errors return to the form.
4. The service writes as the user. RLS limits the write to their rows; CHECK constraints and triggers enforce the data rules again.
5. A row trigger appends an audit entry (hash-chained).
6. `refresh()` re-renders the page; a toast confirms success or explains the error.

## Next.js 16 specifics

- `src/proxy.ts` replaces `middleware.ts` (renamed in Next.js 16; same behaviour).
- **Cache Components** is on. Any component that reads cookies sits behind a
  `<Suspense>` boundary; the fallback is the loading state.
  `createClient()` calls `connection()` so all user data renders at request
  time. Nothing personal is cached.
- Mutations call `refresh()` from `next/cache`.

## Profile completion and readiness

`src/lib/utils/profile-completion.ts` is pure and unit-tested:

- **Completion %**: 18 equally weighted checks on populated fields. Examples:
  name, contact email, headline, experience years, industries, competencies, at
  least one employment record with start dates, at least one qualification, all
  imported records reviewed, preferences saved. Whitespace does not count.
  Nothing is estimated.
- **Readiness**: Not started → Review required → Incomplete (< 80%) → Ready to confirm → Profile complete.
- **Experience shown on the dashboard** is the value you enter. Years covered
  by dated employment records (with overlaps merged) are shown alongside it,
  never substituted for it.

## What is deliberately not here yet

Agents, the Claude API, employer discovery, job feeds, Outlook/Microsoft Graph,
outbound email and immigration tracking. The `user_controls.external_comms_enabled`
column has a CHECK constraint that keeps it `false` in Milestone 1.

---

# Milestone 2 — Employer and job intelligence

Research, analysis and ranking only. **No outward action exists:** no email,
no contact, no application submission, no immigration representation, no
offer handling. `user_controls.external_comms_enabled` stays locked by a
database CHECK.

```
 Public job-board APIs ──GET──▶ lib/ingestion/ats.ts ──▶ normalize.ts (HSEQ + US filter,
 (Greenhouse/Lever/Ashby)        (one read-only request)   salary, sponsorship/citizenship signals)
                                                                     │
 DOL OFLC disclosure CSV ─▶ scripts/import-dol-lca.mts ─▶ lib/ingestion/dol-lca.ts (historical evidence)
                                                                     ▼
                         Postgres: employers · job_opportunities · sponsorship_evidence (RLS, audited)
                                                                     │
                lib/sponsorship/classify.ts  (4 separate classifications, conflict + staleness flags)
                lib/matching/match.ts        (6-component explainable score → job_matches)
                lib/immigration/pathways.ts  (eligibility / requirements / uncertainty → pathway_assessments)
                                                                     ▼
                Pages: Employers · Employer profile · Jobs · Job detail · Immigration · Data sources
```

| Layer | Milestone 2 additions |
|---|---|
| Pure domain logic (`src/lib/**`) | `jobs/` (title filter, salary, text signals), `ingestion/` (ATS adapters, DOL importer, location, names), `sponsorship/classify.ts`, `matching/match.ts`, `immigration/pathways.ts`, `intel/views.ts` (search/filter/sort), `sample/sample-dataset.ts`. All unit-tested with recorded fixtures. |
| Services | `intel.service.ts` (views, ranking agent, evidence, saves), `ingestion.service.ts` (ATS refresh, sample data), `immigration.service.ts` (profile, assessment agent, references, agent runs) |
| Actions | `src/app/dashboard/intel-actions.ts`, via the same `runAction()` (auth, Zod, refresh) |
| "Agents" | Deterministic, auditable runs recorded in `agent_runs`: `employer_intelligence` (ATS refresh, DOL import), `job_matching`, `immigration_intelligence`. No LLM in Milestone 2 (see ADR-019). |
| Scripts | `import:lca` (DOL disclosure import), `verify:sources` (records verification dates only on HTTP 200) |

Search and filter state lives in the URL (plain GET forms), so result pages can
be bookmarked and work without JavaScript. Filtering happens in TypeScript
after one query per table, which suits personal-scale data (hundreds to a few
thousand rows); revisit with SQL-side filtering if volumes grow.

Details: [DATA-SOURCES.md](DATA-SOURCES.md) · [MATCHING.md](MATCHING.md) · [IMMIGRATION.md](IMMIGRATION.md).
