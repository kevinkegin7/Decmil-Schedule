# HSEQ USA Career Agent

Private recruitment workspace for an Australian HSEQ professional targeting
Senior HSEQ Advisor, HSEQ Manager, EHS Manager and Safety Manager roles across
the United States.

**Milestone 1 — foundation:** secure sign-in, editable career profile, employment
history, qualifications with private evidence documents, skills, recruitment
preferences, dashboard, Row Level Security, append-only audit log.

**Milestone 2 — employer and job intelligence:** employer database with official
careers links, HSEQ job discovery from public job-board APIs, salary screening
(USD 120–150k base), sponsorship evidence in four separate classifications with
sources and dates, immigration pathway assessment (E-3 currently ineligible),
explainable job ranking, search, filters, saved items, and clearly labelled
sample data.

**Research only.** Nothing sends email, contacts employers or recruiters, submits
applications, makes immigration representations or accepts offers. External
communications are locked off in the database.

| | |
|---|---|
| App | Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, shadcn/ui-style components on Radix |
| Data | Supabase: PostgreSQL 17, Auth, Storage |
| Forms | React Hook Form + Zod (same schemas on client and server) |
| Tests | Vitest (unit, integration against a real local Supabase), Playwright (E2E, desktop and mobile) |

Docs: [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) ·
[Security](docs/SECURITY.md) · [Data sources](docs/DATA-SOURCES.md) · [Matching](docs/MATCHING.md) ·
[Immigration](docs/IMMIGRATION.md) · [Decisions](docs/DECISIONS.md) · [Roadmap](docs/ROADMAP.md) ·
[Repository migration](docs/REPO-MIGRATION.md)

---

## 1. Prerequisites

- Node.js 22 LTS or newer, npm
- Git
- Docker Desktop (for the local Supabase stack)
- A Supabase account (for the hosted database)

The Supabase CLI is installed as a dev dependency; use it with `npx supabase …`.

## 2. Local setup

```bash
cd hseq-usa-career-agent
npm ci

# Start Postgres, Auth and Storage in Docker; applies migrations and seed.sql
npx supabase start

# Create .env.local from the local stack's keys
cp .env.example .env.local
npx supabase status -o env     # copy API_URL, ANON_KEY, SERVICE_ROLE_KEY into .env.local

npm run dev                    # http://127.0.0.1:3000
```

Sign in with the **local-only** seeded account:

| Email | Password |
|---|---|
| `owner@hseq.local` | `LocalDevOnly-2026` |

The seed loads the starter profile (Decmil, HSE Advisor, Curtin degree, NEBOSH,
ICAM). Every imported record is flagged **Needs review** and every
qualification is **Unverified**: confirm or correct each one.

Reset the local database at any time with `npm run db:reset`.

## 3. Hosted Supabase (production)

1. Create a project in the Supabase dashboard. Choose a region near you
   (for example Sydney, `ap-southeast-2`).
2. Link and push the migrations. Never edit production tables by hand:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push            # applies supabase/migrations/*; does NOT run seed.sql
   ```
3. In **Authentication → Sign In / Providers**: keep Email enabled, **turn off
   "Allow new users to sign up"**, set the minimum password length to 12, and
   set the Site URL to your deployed URL.
4. Create your own account. Sign-up is disabled, so use the admin script with
   the production keys in your shell (not committed):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<secret> \
     npm run user:create -- you@example.com
   ```
5. Sign in and press **Load starter profile** on the Overview page, or start blank.

## 4. Environment variables

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Public anon key; all access is limited by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **scripts and tests only** | Bypasses RLS. Never `NEXT_PUBLIC_`, never imported by `src/`, not needed by the deployed app in Milestone 1 |

`.env.local` is git-ignored. `.env.example` lists the names only.

## 5. Tests

All suites run against the **local** stack (they refuse to run against a remote URL).

```bash
npm run test:unit          # validation, completion %, readiness, formatting
npm run test:integration   # services + RLS + storage + audit against local Supabase
npm run test:e2e           # Playwright: builds the app and drives it (desktop + mobile)
npm run check:secrets      # after a build: no service key in the client bundle or repo
npm run test:all           # lint, typecheck, all of the above
```

E2E needs a Chromium build: run `npx playwright install chromium` once, or set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium binary.

## 6. Employer and job data

- **Try it:** Employers → **Load sample data** (fictional, labelled SAMPLE, removable).
- **Real employers:** Employers → **Add employer** with the official careers page
  and, if the employer uses Greenhouse, Lever or Ashby, the board name. Then
  **Refresh jobs** on its page.
- **Sponsorship history:** download a DOL OFLC LCA disclosure file, save as CSV, then
  `npm run import:lca -- --file <csv> --fiscal-year 2025 --user you@example.com`
- **Verify official references:** `npm run verify:sources` (needs normal internet access).

See [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md).

## 7. Deploying to Vercel (preparation)

- Root directory: `hseq-usa-career-agent`
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  The service-role key is **not** required by the app in Milestone 1; do not add it.
- Add the Vercel URL to Supabase Auth's Site URL and redirect URLs.

## 8. Project layout

```
src/
  app/                 routes: /login, /dashboard/{profile,employment,qualifications,skills,preferences,settings}
    */actions.ts       Server Actions: authenticate → validate (Zod) → service → refresh
  components/          UI by feature; components/ui = shadcn-style primitives
  lib/
    config/            reference data (US states, industries, defaults)
    validation/        Zod schemas shared by forms and Server Actions
    security/          requireUser, safe errors, action wrapper
    supabase/          server / browser / proxy clients (anon key only)
    utils/             profile completion, readiness, formatting
  services/            business logic and data access (no React)
  types/               generated database types + app types
  proxy.ts             session refresh + route guard (Next 16's middleware)
supabase/
  migrations/          SQL migrations (source of truth for the schema)
  seed.sql             LOCAL-ONLY dev account + starter profile
tests/{unit,integration,e2e}
scripts/               check-secrets, create-user
docs/
```
