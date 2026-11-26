# Roadmap

Numbering follows the owner's Milestone 1 brief (Outlook integration = Milestone 4).
Milestones after 1 are **proposed** and get confirmed one at a time. Each ends with
passing tests and the owner's sign-off. **No external communication is enabled
without explicit approval.**

| # | Milestone | Scope | Status |
|---|---|---|---|
| 0 | Architecture & target design | Six-agent design, safeguards, target schema (`docs/design/`) | ✅ Done |
| 1 | Foundation, career profile, dashboard | Auth, profile, employment, qualifications + private evidence, skills, preferences, dashboard, RLS, audit log, tests | ✅ Built |
| 2 | Employer & job intelligence | Employer database, public ATS job discovery, salary screening, sponsorship evidence (4 classes), pathway assessment incl. E-3 currently ineligible, explainable matching, search/filter/sort, saves, audit, sample data | ✅ Built — awaiting owner acceptance |
| 3 | *(to be agreed)* | Candidates: USCIS H-1B hub and PERM importers, scheduled refresh, Claude-assisted posting analysis (labelled, optional), immigration case tracker. Not started until Milestone 2 is accepted. | Not started |
| 4 | Outlook / Microsoft 365 integration | MFA first. Microsoft Graph OAuth with read scopes; inbox classification; reply drafts; approval workflow with content-hash binding; then, **only after owner approval**, Mail.Send with rate limits, suppression list and emergency pause enforcement | Not started |
| 5 | Applications, interviews, offers *(proposed)* | Application tracker, interview scheduling, offer comparison, binding-action confirmations | Not started |
| 6 | Agents & hardening *(proposed)* | Claude-powered agents on the above, activity page, nightly audit verification, security review, go-live | Not started |

## Milestone 1 acceptance checklist

| Criterion | Evidence |
|---|---|
| Application starts | `npm run build && npm start`; E2E suite runs against the production build |
| Authentication works | E2E: login, wrong password, sign-out, protected-route redirect |
| Migrations run | `supabase db reset` applies `20261126000100_milestone1_foundation.sql` cleanly |
| RLS tested | Integration §6 (and mutation check: tests fail when RLS is disabled) |
| Profile created and edited | Integration §1–2, E2E steps 3 and 8 |
| Employment maintained | Integration §3, E2E steps 4 and 8 and the delete-confirmation test |
| Qualifications added and updated | Integration §4, E2E step 5 |
| Preferences persist | Integration §5, E2E steps 6 and 8 |
| Desktop and mobile | E2E desktop project + mobile (Pixel 7) project with no horizontal overflow |
| Automated tests pass | 66 unit, 28 integration, 5 E2E |
| No secrets exposed | `npm run check:secrets` |
| README setup instructions | `README.md` |

## Owner actions before Milestone 2

1. Review and correct every starter record; set dates; verify qualifications.
2. Create the hosted Supabase project and push migrations (README §3).
3. Confirm the proposed Milestone 2 scope.
4. Open decisions carried from Milestone 0: add the E-3 pathway (ADR-008); move this project to its own private repository (ADR-001).

## Milestone 2 acceptance checklist

| Requirement | Evidence |
|---|---|
| Updated architecture and migrations | `docs/ARCHITECTURE.md` (M2 section), migration `20261126000200_…` |
| Employer and job data models | `docs/DATABASE.md` (M2 tables), `src/types/database.types.ts` |
| Source and evidence tracking | `sponsorship_evidence`, job source fields, `data_sources`, `ref_authoritative_sources`; `docs/DATA-SOURCES.md` |
| Matching and ranking methodology | `docs/MATCHING.md`; job page breakdown |
| Unit, integration, E2E tests | 87 new unit (153 total), 18 new integration (46 total), 4 new E2E (9 total), all passing |
| Security and RLS testing | Integration RLS suite for all 9 new tables + mutation check; `check:secrets` |
| Dashboard with sample data clearly identified | Employers, Jobs, Immigration, Data Sources pages; SAMPLE badges; E2E asserts the label on every sample card |
| Data sourced / refreshed / verified docs | `docs/DATA-SOURCES.md` |
| E-3 classified `currently_ineligible — Australian citizenship required` | Unit, integration and E2E tests |
| Repository migration plan | `docs/REPO-MIGRATION.md`, `scripts/export-to-private-repo.sh` (dry run passed) |
