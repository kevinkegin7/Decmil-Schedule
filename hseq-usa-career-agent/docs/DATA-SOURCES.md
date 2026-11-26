# Data sources: how data is sourced, refreshed and verified

Milestone 2 researches employers and jobs. It never contacts anyone. Every
material claim stored by the platform carries **where it came from, when it was
retrieved, and how confident we are**.

## 1. Permitted sources

| Source | What it gives | How it is accessed | Permission basis |
|---|---|---|---|
| **Greenhouse Job Board API** (`boards-api.greenhouse.io`) | An employer's published open jobs, incl. pay ranges where the employer publishes them | One read-only `GET` per employer when you press **Refresh jobs** | Public API Greenhouse documents for showing an employer's jobs |
| **Lever Postings API** (`api.lever.co/v0/postings`) | Published postings, salary range field | Same | Public API documented by Lever |
| **Ashby Public Job Posting API** (`api.ashbyhq.com/posting-api`) | Published postings, compensation | Same | Public API documented by Ashby |
| **DOL OFLC LCA / PERM disclosure files** | Past certified filings by employer, SOC code, visa class, wage | You download the official file; `npm run import:lca` imports it | US government public data |
| **USCIS H-1B Employer Data Hub** | Past H-1B petition decisions | Planned importer (same pattern); evidence type exists | US government public data |
| **Employer official careers page** | Policy statements, e.g. "we do not sponsor" | **Link only.** You read the page and record the exact wording | No automated access |
| **You** | Written confirmation from an employer | You record it (verified by you) | Your own correspondence |

**Not used:** LinkedIn or other sites whose terms forbid automated access, any
login-protected page, any scraping of careers pages, and guessed data. The app
sends a descriptive `User-Agent`, makes one request per board per refresh, and
times out after 15 seconds.

## 2. What is stored for each claim

| Claim | Source fields | Confidence |
|---|---|---|
| A job exists | `source`, `source_url` (the employer's posting), `retrieved_at`, `first_seen_at`, `last_seen_at`, `status` | n/a |
| Salary | `salary_source` = `structured` (API pay field) / `extracted_text` (read from the posting) / `none` | `high` / `medium` / `none` |
| Posting says it sponsors / does not | `sponsorship_statement` + exact `sponsorship_excerpt`; also written as a `sponsorship_evidence` row | `medium` (automatic text detection) |
| Requires US citizenship / clearance | Flags set from the posting text; the excerpt is shown on the job | n/a |
| Sponsorship evidence | `evidence_type`, `source`, `source_url`, `excerpt`, `retrieved_at`, `verified_at`, `verified_by`, `confidence` | `high` / `medium` / `low` |
| Immigration rule | `ref_authoritative_sources` (official URL, `last_verified_at`, note) | Date shown only after a real check |

The database enforces these: evidence must have a source URL (unless it is your
own written confirmation) and a retrieval date. A written confirmation must be
marked as verified by you. Government history must name a fiscal year.

## 3. Sponsorship classifications (kept separate)

| Classification | Meaning | Evidence that can produce it |
|---|---|---|
| **Confirmed sponsorship** | The employer itself says it sponsors | Written confirmation to you; the employer's own posting or official page |
| **Historical evidence only** | Government records show past filings | DOL LCA / PERM, USCIS H-1B hub, **only** |
| **No evidence found** | Nothing recorded either way | — |
| **Explicitly no sponsorship** | The employer itself says it does not sponsor | The employer's own posting or official page |

- `sponsorship_evidence.category` is a **generated column**, so a historical
  record cannot be stored as confirmed.
- The most recent first-party statement decides. If two statements share a
  date, the cautious one ("no") wins.
- Conflicts are **flagged, not hidden**: offers vs. refusals, or "no" now
  despite past filings.
- Staleness: statements older than 180 days and filings older than 3 fiscal
  years are flagged.
- A job's own statement overrides the employer-level classification for that
  role, and the job shows which one it used.

## 4. Refresh

| Data | How to refresh | Notes |
|---|---|---|
| Jobs for an employer | Employer page → **Refresh jobs from …** (requires the provider and board name) | US HSEQ postings are kept; others are skipped with a reason. Postings no longer on the board become `closed` (kept for history). Rankings are recomputed. Recorded as an agent run. |
| DOL LCA history | Each quarter: download the file, save as CSV, run `npm run import:lca -- --file <csv> --fiscal-year <FY> --user <email>` | Matches your employers by FEIN (high confidence), then exact name (medium). Re-importing a year replaces that year. Unmatched top sponsors are listed for you to consider. |
| Employer statements | When you re-check a page, press **Re-checked today** on the evidence | Updates `verified_at` / `verified_by` |
| Official immigration references | `npm run verify:sources` from a machine with normal internet access | A date is written only when the page returns HTTP 200 |
| Rankings | Jobs page → **Re-run ranking** (also automatic after loading data) | The page warns when rankings are older than your profile, preferences or the jobs |

**Current verification status:** none of the official government URLs has been
verified yet. The build environment's network blocks those sites (DNS failure),
so every reference shows **"Not yet verified"** until you run `verify:sources`.
The Lever postings API documentation was reachable and confirmed. No date has
been invented.

## 5. Sample data

`Load sample data` creates **8 fictional employers and 12 fictional postings**
across 8 states, covering all four sponsorship classifications and the edge
cases: a posting that requires US citizenship, an hourly role, a director-level
role, below-target pay, conflicting and stale evidence. They:

- are named `Sample — …`, use `example.com` URLs and the `sample` source, and
  set `is_sample = true` on every row;
- show a **SAMPLE DATA** badge everywhere, can be hidden with a filter, and
  cannot be "refreshed";
- are removed completely with **Remove sample data**, which leaves your own
  data untouched.

They are not real companies and say nothing about any real employer's sponsorship.

## 6. Known limits

- Coverage depends on which employers you add (with their public job board)
  and which DOL files you import. The schema accepts all 50 states and DC; the
  employer list shows how many states your data covers.
- Text detection of sponsorship wording is pattern-based. It returns the exact
  excerpt it relied on, so it can be checked. It is `medium` confidence by design.
- Workday and other job boards without a published public API are not
  supported. Add those employers with their careers link and record
  statements manually.
