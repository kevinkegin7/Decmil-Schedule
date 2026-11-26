# Roadmap

Numbering follows the owner's Milestone 1 brief (Outlook integration = Milestone 4).
Milestones after 1 are **proposed** and get confirmed one at a time. Each ends with
passing tests and the owner's sign-off. **No external communication is enabled
without explicit approval.**

| # | Milestone | Scope | Status |
|---|---|---|---|
| 0 | Architecture & target design | Six-agent design, safeguards, target schema (`docs/design/`) | ✅ Done |
| 1 | Foundation, career profile, dashboard | Auth, profile, employment, qualifications + private evidence, skills, preferences, dashboard, RLS, audit log, tests | ✅ Built — awaiting owner acceptance |
| 2 | Employer intelligence & job opportunities *(proposed)* | Employer database, public ATS job feeds (Greenhouse/Lever/Ashby), fit scoring against the verified profile, job pages. No outreach. | Not started |
| 3 | Sponsorship & immigration intelligence *(proposed)* | DOL LCA/PERM disclosure import, sponsorship evidence with honest labels, E-3 / H-1B / EB-2 / EB-2 NIW / EB-3 / L-1 assessments citing government sources, immigration tracker. Not legal advice. | Not started |
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
