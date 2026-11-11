# Decmil Take 5 Compliance — Site Diary R4 tooling

Work on the Take 5 Compliance page of Site Diary R4 (`sdr10265ui`) for
project 10265, and the standalone tools that reproduce the team's daily
management report.

| Path | What it is |
|---|---|
| `src/take5.js` | Drop-in replacement for `/js/take5.js`: exemption rules, site-specific classification, the **Daily email** modal |
| `src/take5-site-report.js` | The daily report: classification by the site rules, the Maintenance/Operations table, the sentence, email text/HTML |
| `src/take5-visuals.js` | The report card (hero figure, group tiles, segmented bar, crew meters, trend) and the Outlook-safe version |
| `src/take5-workbooks.js` | Reads the Site Diary export and the register workbook; shared by the CLI and the browser page |
| `src/take5-role-classification.js` | Role-pattern fallback used when no site config is loaded |
| `config/site-10265.json` | **The site's rules** — keyword lists, optional people, groups, minimum per day. Edit this, not the code |
| `tools/take5-report.js` | CLI: the same report from a Site Diary export, optionally reconciled against the register workbook |
| `tools/report-page.template.html`, `tools/build-report-page.js` | The browser version: `node tools/build-report-page.js` writes `dist/take5-report.standalone.html`, a single file to open in Edge or Chrome and drop the two workbooks onto (needs internet for one script) |
| `docs/take5-daily-report-findings.md` | What the two spreadsheets do, what is wrong with the capture data, what was built, open decisions |
| `docs/deploying-take5-js.md` | How IT deploys the page files |
| `docs/take5-role-exemption-spec.md` | The server-side change that makes the trend chart and overrides correct |
| `current-system/` | Reference copies of what was live |
| `test/` | Fixtures (anonymised) and the headless-Chromium page tests |

```
npm install          # jQuery and SheetJS, dev only
npm test             # classifier, report conformance, visuals, browser suite
npm run report -- <capture.xlsx> --register <register.xlsm> --html out.html
```

No employee names are committed: fixtures carry the real roles, crews,
companies and counts with synthetic names.
