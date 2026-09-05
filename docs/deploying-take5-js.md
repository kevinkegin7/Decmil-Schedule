# Deploying the patched `take5.js`

**For:** Site Diary R4 IT team · **App:** `sdr10265ui` (and any other project running the Take 5 module)
**File:** `src/take5.js` in this repository → `wwwroot/js/take5.js` in `SiteDiaryR2.UI`

This is a front-end-only change. It replaces one static file and touches no
controllers, views, database or configuration. It is the interim fix for the
defect in `docs/take5-role-exemption-spec.md`; the server-side change in that
spec is still the proper fix and this file keeps working unchanged once it lands.

---

## What it does

Classifies every person on the Take 5 page as **required** or **exempt** from
their `Role` string and keeps exempt people out of the compliance maths:

| Area | Before | After |
|---|---|---|
| Daily Capture list | everyone has a stepper and is in the % | exempt rows shown muted as "Exempt", no stepper, out of the % |
| Capture summary strip | On site = row count | Required on site · Exempt (not counted) shown separately |
| Dashboard hero (%, on site, to action, tags, avg) | server figures over everyone | recomputed over required people, exempt count shown |
| Action list | everyone below minimum | required people only |
| **Notify supervisors** | emailed everyone below minimum | emailed required people only |
| Compliance by crew | everyone | required people only |
| Leaderboards | everyone | required people only |
| Running totals | everyone | everyone, exempt marked and not counted |
| Excel exports (both) | no distinction | `Required` column; exempt count in summary |
| Per-person override | none | "mark exempt / mark required" link on each capture row |

Rules and the full role list are in the spec. In short: supervisors,
superintendents, engineers, managers, administrators, advisors and senior
surveyors are exempt; everyone else is required.

## What it does not do

- **The trend chart still includes exempt roles.** Its per-period percentages
  come from `GetDashboard` pre-computed, with no per-person breakdown to
  recompute from. The chart is labelled accordingly until the server change.
- **Overrides are per browser** (`localStorage`), not shared. The spec's
  `SetRequired` endpoint replaces this.

## Deploy

1. Copy `src/take5.js` over `wwwroot/js/take5.js`.
2. Build and deploy as normal. The `<script src="/js/take5.js" asp-append-version="true">`
   tag helper hashes the file, so the `?v=` cache-buster updates by itself —
   no Razor change is needed.
3. Smoke test on `/Take5` (below).

To roll back, restore the previous `take5.js`. A copy of the version that was
live on 4 Sept 2026 is at `current-system/take5.js`.

## Smoke test after deploy

On `/Take5` for 10265, with the date set to a full-roster weekday:

- [ ] Capture strip shows **Exempt (not counted)** ≈ 35 and **Required on site** ≈ 148
- [ ] A Project Manager / HSE Advisor row is muted, tagged "Exempt", with no −/+ stepper
- [ ] "mark required" on that row moves it into the count; "mark exempt" moves it back
- [ ] Dashboard hero "On site in range" sub-line reads "N exempt not counted · …"
- [ ] Action list count is lower than before and contains no Site Office personnel
- [ ] "Notify supervisors" body starts "… N required on-site personnel below minimum (exempt … excluded)"
- [ ] Compliance by crew no longer lists Site Office crews
- [ ] Both Excel exports open and show the `Required` column
- [ ] Browser console shows no new errors

## Verifying the file before deploy

```
npm install      # jQuery only, for the harness
npm test
```

`npm test` runs the classifier against all 40 job titles on 10265, then drives
the page in headless Chromium against a mock of both endpoints and checks
every number above (58 assertions). Playwright's Chromium is required for the
second part.

## Keeping the rules in one place

The classifier is inlined at the top of `take5.js` and also lives in
`src/take5-role-classification.js`. The test suite asserts the two are
identical. When the server-side C# from the spec is written, all three must
agree, or the capture tab and the dashboard will disagree with each other.
