# Take 5 daily reporting — findings and the site-specific build

**Project:** 10265 WASP WH Bulk Earthworks · **Date:** 10–11 Nov 2026
**Inputs:** `Take5_Capture_2026-11-09_2.xlsx` (Site Diary export, Mon 9 Nov) and
`Decmil_Take_5_and_KPI_register.xlsm` (the team's hand-kept register, saved with
its Email Report set to Sun 8 Nov)

---

## 1. What each file is

**The Site Diary capture export** is the `/Take5` Daily Capture tab's Excel
export: 131 people with Name, Gender, Role, Crew, Company, Tags, Minimum,
Status, and a summary line *"On site: 131 · On track: 90 · Below min: 41 ·
Compliance: 69% · Minimum/day: 1"*.

**The register workbook** is the system the team actually reports from. Its
daily procedure, reconstructed from its own instruction cells and formulas:

1. Export the Site Diary capture list.
2. Paste **only** Name, Gender, Role, Crew, Company (no header) into
   `Email Report!G5` and set the date in `H1`.
3. Type each person's paper Take 5 count into `TAKE 5's` for that date
   (one column per day from 28 Mar 2026 to 8 Jan 2027).
4. Check the banner in `A12` — it says *CHECK FIRST* if nothing has been
   typed for that date yet.
5. Run the `AddNewStarters` macro if the NEW PEOPLE block lists anyone.
6. Copy `A3` (the sentence) and `A4:D8` (the table) into the email.
7. Paste-value the Daily Log row so the Stats sheet's weekly and monthly
   figures accumulate.

The Email Report sheet looks each pasted name up in the register (exact
name, then first word + last word), reads that person's count for the date,
compares it with the single site minimum (`Stats!B3` = **3**), and classifies
them with four keyword lists:

| List | Applied to | Current contents |
|---|---|---|
| Exclude roles containing (U) | role | supervisor, manager, admin, senior, trainer, superintendent, advisor, engineer, coordinator, planner |
| Not required: role **or crew** containing (W) | role + crew | site office, corporate, office staff |
| Optional (manual): name or role containing (X) | name + role | John Brady, Mark Hitchens, surveyor |
| Maintenance roles containing (V), or crew starting "Maint" | role, crew | mechanic, fitter, serviceperson, boilermaker, electrician, storeperson |

Precedence, from the formulas: **Optional is tested first** (an optional person
is counted only on days they have Take 5s, and is never "Not required"), then
Not required, then *Not in register*, then In range (≥3) / No Take 5 (0) /
Below min (1–2). Crew Size counts included people; Take 5s sums their counts;
Ratio is Take 5s ÷ Crew Size; "Crew members Completing Zero" counts the
included people at zero, who are also the names in the sentence.

The hidden `Platform Import` sheet is **not** Site Diary data: it is a pasted
export of 181 documents (1–17 Oct 2026) from a field-safety platform the
workbook itself labels "SAI 360" (Spotlights, Journeys, Area Inspections,
permits for "PRJ: Rio Tinto Projects", team `WASPDECMIL`). It holds no Take 5
documents of any kind, so it cannot be a count source. Its only consumer is
the hidden `Weekly KPI` tracker of leadership indicators for 23 named leaders,
which nothing visible reads, whose as-at date is a typed 23 Oct 2026, and
whose name matching silently drops three of the 23. It is stale, not live.

The `Stats` sheet's Daily column mirrors the Email Report. Its Weekly and
Monthly columns switch between two sources: the pasted `Daily Log` rows when
every recorded day in the period has one, otherwise a "register estimate"
whose crew size counts only people who did at least one Take 5 that day. The
estimate path is the one in use, and it flatters the result by construction
(101–104% "Above target (est.)" on the saved file). Its helper ranges also
stop at register rows 353 and 341, so the last person in the register, and
anyone below row 341 in the per-date totals, is silently left out.

**These rules are now in `config/site-10265.json`**, and the module
`src/take5-site-report.js` reproduces the sheet's own Include / Group / Status
columns for all 127 pasted people and its four totals exactly
(`node src/take5-site-report.test.js`).

---

## 2. What is wrong with the capture data

Four separate things, in order of impact.

**1. The minimum is 1, not 3.** Every exported row carries `Minimum = 1`, and
Status is "On track" for anyone with a single tag. So *"Compliance: 69%"* is
measured against the wrong bar. The site rule, in the register and in the
Stats sheet, is 3 per person per day. Under the site rules the same 131
people give 97 required, 84 at 3 or more: **87%**. If 1 was set deliberately
because Site Diary records *whether* someone submitted rather than *how many*,
that is a decision the team needs to make explicit (see §5).

**2. Office and management roles are still counted.** Engineers, supervisors,
managers, HSE and administrators in the Site Office crews are in the list,
in the denominator and in the "No Take 5" count. The exemption patch from
September is not what is live: the export has 8 columns and no Required
column. Under the site rules **31 of the 131 are Not required** and 3 more
are optional surveyors at zero.

**3. The tag counts look like a tick, not a count.** 80 of the 90 people with
tags have exactly 3. The register, by contrast, holds real counts (2, 4, 5,
6, 7 appear routinely). This is consistent with the capture tab's "Set 3"
button being used as "handed in a Take 5". The two systems are therefore
measuring different things: Site Diary ≈ submitted, register = how many.

**4. The register snapshot cannot adjudicate 9 Nov.** The workbook's 9 Nov
column is empty and its 8 Nov column holds 25 entries against a normal ~90,
so the saved Email Report's *"69 people who didn't do take 5s"* and the
Operations ratio of 0.38:1 are artefacts of a day not yet typed in, not a
result. Its banner cell `A12` exists for exactly this reason. On 7 Nov, where
both sources are complete, the two agree for 81 of the 109 matched people;
of the 28 differences, 9 have Site Diary tags with a blank register cell, 4
the reverse, and the rest different counts.

Also found while reconciling:

- The pasted list in the register is the **8 Nov** export (127 people), not
  9 Nov (131). Five names appear only in the sheet, nine only in the export.
- 22 Site Diary names are not in the register at all. 19 are office staff
  the site rules exclude anyway; the other three are required and would be
  flagged *Not in register*: two "Technician " (trailing space) in Ops - STW
  and one surveyor in "Perth Office ".
- One name resolves only through the first-word/last-word fallback
  ("Nathan Timothy Smith" → "Nathan Smith").
- The register's own data has hazards for any automation: a duplicated
  Thursday column for 3 Sep 2026 (the hidden "Thu Mk2"), a near-empty gap
  from 20 Jun to 28 Aug, an "Active" flag that is not maintained (346 of 351
  Active while 131 are on site), free-text crews and companies that mostly
  do not match Site Diary's strings, text codes such as "Sick" that the
  Email Report counts as 0, lookups hard-wired to rows 4–354, and a missing
  formula at `Email Report!E22`.
- The `Daily Log` rows are snapshots taken when they were pasted, not of the
  finished day. On 15 Oct the log holds 197 Take 5s against 319 in the
  register for the same date, so some days were logged before typing was
  complete. Any trend drawn from the Daily Log inherits that, and the Stats
  sheet's weekly and monthly figures depend on it being complete (§1).
- The report date is typed by hand in `Email Report!H1` and the day's
  register column is found by matching it; if the date is missing from row 3
  every count silently becomes 0.

**How sure is this.** The claims above were produced by independent reviews
of each sheet and then challenged by two further passes per key finding, one
working only from the formulas and one only from the values. Twenty-four key
findings survived both; none was refuted. The seven findings about the
Platform Import sheet were still being re-checked when this was written.

---

## 3. What the register gives management that the Site Diary page did not

- The site-specific exclusion and grouping rules above.
- The email itself: the sentence naming everyone at zero, and the
  Maintenance / Operations table (Crew Size, Take 5s, Ratio, Zero).
- A guard against reporting an unfilled day.
- A ranked follow-up table: zeros first, then below-minimum, with each
  person's last Take 5 date, days at minimum this week, and a consistency
  ratio.
- Daily Log history and the Stats sheet's daily / weekly / monthly figures
  against target, with the caveat in §1 that the weekly and monthly figures
  are only exact when every day has been logged.
- A separate, now stale, leadership-indicator tracker (PTHA reviews, QSI,
  Spotlights, Area Inspections per week; CCFV and CCVS per month), which is
  not about Take 5s and is out of scope here. Whether the team still wants it
  is its own question.

---

## 4. What has been built

All of it is driven by `config/site-10265.json`; nothing site-specific is in
code. Edit the lists, not the JavaScript.

**`src/take5-site-report.js`** — the rules and the report. Classifies each
person (Optional → Not required → Not in register → In range / Below min /
No Take 5, with per-person overrides), builds the two-group table, the
sentence, the Daily Log row and the totals, and formats the email as text or
HTML. Counts can come from Site Diary's tags or from any other source (the
CLI passes the paper register).

**`src/take5-visuals.js`** — the report card: compliance as a hero figure
with a meter, one stat tile per group showing the ratio against the 3.0
target, a segmented bar of In range / Below minimum / No Take 5, a meter list
of crews worst-first, an optional 14-day trend, and the two name lists. Plus
an Outlook-safe version built from tables, because email clients drop SVG.
Colours follow the data-visualisation method in the repo's tooling: one
blue for magnitude, the reserved status colours only where a state means
good / warning / critical, always with an icon and a label; palette and
text contrasts validated.

**`src/take5.js`** (the Site Diary page) now, when the site config is loaded:

- applies the site rules on the Daily Capture tab (Not required and
  Optional rows muted with no stepper), on the dashboard and in the exports;
- uses the **site minimum** (3) in place of the server's setting and says so
  when they differ;
- adds a **Daily email** button that opens the report card, the email text,
  the Daily Log row, and *Copy text* / *Copy with graphics* buttons.

**`tools/take5-report.js`** — the same report from the files, for the days
the team keeps the paper register:

```
node tools/take5-report.js Take5_Capture_2026-11-09.xlsx \
     --register "Decmil_Take_5_and_KPI_register.xlsm" \
     --counts register|sitediary --html report.html --json report.json
```

It prints the email, the Daily Log row and the figures; warns about the
minimum mismatch, the "exactly 3" pattern, an empty or half-typed register
column and text codes; lists every person whose Site Diary tags and register
count differ, everyone on the Site Diary list but not in the register, and
every register entry for the date from someone not on the list (the Stats
sheet's "Other / unassigned"). `--html` writes the card, the Outlook version,
a trend from the register's Daily Log, and a table view of every person.

**Tests.** `npm test` runs the classifier suite (40 roles), the report
conformance suite (the workbook's 127 rows and totals), the visuals suite,
and a headless-Chromium run of the page against a mock of both endpoints
built from the real 9 Nov roster shape.

---

## 5. Decisions the team still has to make

1. **Which count is the record: the paper register or Site Diary?** Today
   Site Diary's tags are a tick (3 = handed in) and the register holds the
   real numbers. Either make the page's counts real (type the number, not
   "Set 3") and retire the paper column, or keep the register as the record
   and let the page report submission only. The 3-per-day target cannot be
   reported from a tick.
2. **Minimum per day on the server.** If counts become real, the server
   setting should be 3 (or the page's site minimum stays as the override).
3. **Denominator rules the register uses today and the build reproduces:**
   optional people count only when they have Take 5s; people not found in
   the count source stay in Crew Size with 0 but are not named as zeros;
   surveyors in Site Office crews are optional, not excluded. Keep or change,
   but say which.
4. **Where the config lives.** A JSON file per project served as
   `/js/take5-site-config.js` is the smallest step; a settings page is the
   proper one.

---

## 6. Not built, deliberately

- The follow-up table's per-person history (last Take 5 date, days at
  minimum this week). The dashboard payload already carries on-site days,
  compliant days and a five-day spark per person, so this is a small
  follow-on once the counts question in §5 is settled.
- Weekly and monthly Stats. The dashboard's date range covers the same
  ground; the register's "Days with Take 5s recorded" logic depends on
  blank-means-absent, which Site Diary does not need.
- New-starter detection. Site Diary *is* the personnel list.
