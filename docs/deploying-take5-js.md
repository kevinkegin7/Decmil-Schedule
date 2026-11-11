# Deploying the patched `take5.js`

**For:** Site Diary R4 IT team · **App:** `sdr10265ui` (and any other project running the Take 5 module)
**Files:** `src/take5.js`, `src/take5-site-report.js`, `src/take5-visuals.js` and a generated
`take5-site-config.js` → `wwwroot/js/` in `SiteDiaryR2.UI`

This is a front-end-only change. It touches no controllers, database or configuration;
it adds three static files and three script tags. It is the interim fix for the defect in
`docs/take5-role-exemption-spec.md`; the server-side change in that spec is still the
proper fix and these files keep working unchanged once it lands.

---

## What it does

With the site config loaded, the page follows the project's own rules (the same lists
the team's Excel register uses, in `config/site-10265.json`) and can build the daily
management email:

| Area | Before | After |
|---|---|---|
| Who counts | everyone the roster sends | Not required (role/crew keywords) people shown muted with no stepper; Optional people keep the stepper and count only on days they log a Take 5 |
| Minimum per day | the server's setting (currently 1) | the site rule (3), with the server value shown when it differs |
| Daily Capture summary | On site = row count | Required on site · Exempt (not counted) separately; Excel gets a `Required` column |
| Dashboard hero, action list, **Notify supervisors**, crew rollup, leaderboards, running totals, exports | over everyone | over required people, exempt count shown |
| **Analytic** tab (new, added by `take5.js`; the view markup is unchanged) | — | the daily management report laid out as the email (greeting, Maintenance / Operations table, TODAY line, follow-up table), a 14-day trend, and **Notify**: To / Cc / Subject / sign-off, posted to the existing `/Take5/Notify` endpoint with `Body` (text), `BodyHtml` (formatted) and `IsHtml=true`. Recipients and sign-off are remembered per browser; Notify is blocked while no counts are entered for the date. **Server change needed:** `/Take5/Notify` must send `BodyHtml` as the HTML body when present, otherwise management receives the text version. |
| Per-person override | none | a **Required / Not required / Optional** control on each capture row, the rule's verdict marked "(rule)", manual choices marked "(manual)" |
| **Email Report panel** (Daily Capture) | — | the register's Email Report sheet on the page: title, CHECK FIRST / TODAY banner, sentence, Maintenance/Operations table, Daily Log row, and the follow-up table (today, last Take 5, this week's days at minimum, consistency) |
| **Take 5 statistics** (Dashboard) | — | the register's Stats sheet under the site rules, from each day's capture: trend, and by day / Sat–Fri week / month per group: crew size, Take 5s, target, over/under, % of target, status, avg per person, at minimum, zeros |

Without the config files the page falls back to the role patterns alone, as before.

## What it does not do

- **The server trend chart still includes exempt roles.** Its per-period percentages come from
  `GetDashboard` pre-computed; the chart is labelled accordingly until the server change. The
  **Take 5 statistics** panel below it is the corrected trend: it re-reads each day's `GetCapture`
  (one request per day in the range, capped at 70 days) and applies the site rules.
- **The Email Report panel's history columns** (last Take 5, this week, consistency) use the same
  per-day captures for the previous 14 days, so they show "…" for a moment while those load.
- **Overrides are per browser** (`localStorage`). The spec's `SetRequired` endpoint replaces this.
- **Email counts are Site Diary's tag counts.** If the team's record is the paper register,
  use `tools/take5-report.js` with `--register` instead (see the findings doc, §5).

## Deploy

1. Copy to `wwwroot/js/`: `src/take5.js` (over the existing file), `src/take5-site-report.js`,
   `src/take5-visuals.js`.
2. Generate the config script from the project's rules file and put it beside them:
   ```
   node -e "console.log('window.Take5SiteConfig = ' + require('fs').readFileSync('config/site-10265.json','utf8') + ';')" > take5-site-config.js
   ```
   One file per project; the rules differ per site.
3. In the Take 5 view (`Views/Take5/Index.cshtml`), load the three new files **before** `take5.js`:
   ```html
   <script src="/js/take5-site-report.js" asp-append-version="true"></script>
   <script src="/js/take5-visuals.js" asp-append-version="true"></script>
   <script src="/js/take5-site-config.js" asp-append-version="true"></script>
   <script src="/js/take5.js" asp-append-version="true"></script>
   ```
   `asp-append-version` hashes each file, so the `?v=` cache-busters update by themselves.
4. Build and deploy as normal, then smoke test on `/Take5` (below).

To roll back, restore the previous `take5.js` and remove the three tags. The version that
was live on 4 Sept 2026 is at `current-system/take5.js`.

## Smoke test after deploy

On `/Take5` for 10265, with the date set to a full-roster weekday:

- [ ] Capture strip shows **Required on site** ≈ 97 and **Exempt (not counted)** ≈ 34 for a 131-person day
- [ ] Header reads "site minimum **3**/day (server setting is 1)" until the server setting is changed
- [ ] A Project Engineer / HSE Advisor row is muted, tagged "Exempt", with no −/+ stepper; a surveyor at zero is tagged "Optional" and still has a stepper
- [ ] Setting a row to **Required** moves it into the count; **Not required** moves it out; **Optional** counts it only once a Take 5 is entered; choosing the "(rule)" option clears the override
- [ ] The **Take 5 Report for the d/m/yy** panel under the list shows the banner, sentence, table, Daily Log row and follow-up table, matching the register's Email Report for the same counts
- [ ] Dashboard **Take 5 statistics (site rules)** loads the range's days and shows the trend plus day / week / month tables
- [ ] **Analytic** shows the report for the selected date; the Maintenance/Operations table matches the register's Email Report for the same counts
- [ ] **Notify** delivers the formatted email (tables and colours intact in Outlook) to the To / Cc addresses, and the recipients are pre-filled the next day
- [ ] Dashboard → *Exclude crews* stays open while several crews are ticked and closes on an outside click
- [ ] Action list contains no Site Office personnel; "Notify supervisors" body starts "… N required on-site personnel below minimum"
- [ ] Both Excel exports open and show the `Required` column
- [ ] Browser console shows no new errors

## Verifying the files before deploy

```
npm install      # jQuery and SheetJS, for the harness and the CLI
npm test
```

`npm test` runs the classifier against all 40 job titles on 10265, the report module
against the register's own 127 pasted rows and totals, the visuals, and then drives the
page in headless Chromium against a mock of both endpoints (66 assertions).

## Keeping the rules in one place

Site rules live only in `config/site-10265.json`. The role-pattern classifier inlined
at the top of `take5.js` is the fallback for a page with no config; it also lives in
`src/take5-role-classification.js`, and the tests assert the two are identical. When the
server-side C# from the spec is written, read the same JSON there, or the capture tab
and the dashboard will disagree with each other.
