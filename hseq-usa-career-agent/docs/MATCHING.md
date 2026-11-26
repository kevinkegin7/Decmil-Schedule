# Matching and ranking methodology (`m2-v1`)

Deterministic and explainable. The score is the **sum of six components**. Each
component returns its points and the reasons behind them, and the job page
shows all of it. There is no hidden model or opaque weighting. Code:
`src/lib/matching/match.ts`; tests: `tests/unit/m2-sponsorship-matching.test.ts`.

| Component | Max | How points are given |
|---|---|---|
| **Role and seniority** | 25 | Title matches one of your target titles → 25. Otherwise by seniority read from the title: manager/senior/lead 20, advisor/specialist 15, director 14 (flagged above target), executive 8 (flagged), technician/junior 5 (flagged below experience). Non-HSEQ title → 0 and **not viable**. |
| **Industry** | 15 | Employer industry in your preferred industries → 10, plus 5 if you have experience in it (career profile or employment records). Unknown industry → 5. |
| **Location** | 10 | Remote → 10. State in your preferred states → 10. State unknown → 5. Other state → 0. |
| **Salary** (annual base, USD) | 20 | Compared with your target range (default $120,000–$150,000): within 20, overlaps 16, above 14 (flag: check seniority), not published 8 (flag), below 0–6 (6 if within 10% of your minimum; flag). Hourly pay × 2,080 hours, marked as an estimate. |
| **Visa sponsorship** | 20 | Confirmed 20, historical evidence only 12, no evidence 6, explicitly no 0. The job's own statement overrides the employer's. |
| **Experience and credentials** | 10 | Years: meets the posting's largest "N+ years" → 5; within 2 → 3; not stated → 3; your years not set → 2; else 0 (flagged). Credentials: share of credentials named in the posting that appear in your qualifications or competencies, out of 5 (3 if none named). Unverified credentials are labelled "not yet verified". US-specific credentials you lack (CSP, ASP, CHST, CIH, OSHA 30/500, MSHA) are flagged as gaps. |

## Bands

| Band | Rule |
|---|---|
| **Not viable** | You need sponsorship and the role explicitly offers none; or the posting requires US citizenship / US-person status or a security clearance; or it is not an HSEQ role. Overrides the score. |
| Strong match | score ≥ 75 |
| Good match | 60–74 |
| Worth considering | 40–59 |
| Low match | < 40 |

When ranking by match, not-viable roles always sink to the bottom. They are
shown, not hidden, so you can see why.

## Inputs and freshness

- Candidate inputs come from your recruitment preferences and career profile
  (target titles, states, industries, salary, sponsorship requirement, total
  years, industries of experience), plus your qualification names (with
  verification state) and competencies.
- Each stored ranking records `algorithm_version`, an `inputs_hash` of those
  inputs, `computed_at` and the agent `run_id`. The Jobs page warns when any
  ranking is older than your current inputs or than the job itself.
- Every ranking write is in the audit log (`job_matches.insert/update`), and
  each run is an `agent_runs` row with a summary.

## What it deliberately does not do

- It does not invent missing data. Unknown salary, years or industry get a
  neutral partial score and a visible flag.
- It does not treat historical filings as willingness to sponsor.
- It does not use an LLM in Milestone 2, so results are reproducible and
  testable. Claude-assisted analysis can be added later as a separate,
  labelled component.
