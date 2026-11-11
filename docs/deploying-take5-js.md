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
| Who counts | everyone the roster sends | Not required (role/crew keywords) and Optional-at-zero people shown muted, no stepper, out of every figure |
| Minimum per day | the server's setting (currently 1) | the site rule (3), with the server value shown when it differs |
| Daily Capture summary | On site = row count | Required on site · Exempt (not counted) separately; Excel gets a `Required` column |
| Dashboard hero, action list, **Notify supervisors**, crew rollup, leaderboards, running totals, exports | over everyone | over required people, exempt count shown |
| **Daily email** (new button on Daily Capture) | — | the report card, the email text, the Daily Log row, *Copy text* and *Copy with graphics* |
| Per-person override | none | "mark exempt / mark required" on each capture row |

Without the config files the page falls back to the role patterns alone, as before.

## What it does not do

- **The trend chart still includes exempt roles.** Its per-period percentages come from
  `GetDashboard` pre-computed; the chart is labelled accordingly until the server change.
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
- [ ] A Project Engineer / HSE Advisor row is muted, tagged "Exempt", with no −/+ stepper; a surveyor at zero is tagged "Optional"
- [ ] "mark required" on an exempt row moves it into the count; "mark exempt" moves it back
- [ ] **Daily email** opens the card; the sentence and the Maintenance/Operations table match the register's Email Report for the same counts
- [ ] *Copy text* pastes the email body; *Copy with graphics* pastes the figures, bars and table into Outlook (needs HTTPS, which the site has)
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
