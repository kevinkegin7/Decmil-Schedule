# Take 5 Compliance — excluding non-field roles from the compliance denominator

**Project:** 10265 WASP WH Bulk Earthworks · Site Diary R4
**Raised by:** Kevin Kegin (HSE Advisor)
**Status:** Specification — awaiting server-side implementation

---

## 1. The problem

The roster now feeds the Take 5 on-site personnel list. That list includes
administrators, engineers, HSE advisors, managers and directors — people who
are not expected to complete field Take 5 tags. They are counted anyway, so
the compliance percentage is wrong and the reports cannot be relied on.

`/Take5/GetCapture` returns every person the roster puts on site, and
`take5.js` uses the raw row count as the denominator:

```js
// take5.js line 96
var onsite = state.capture.length, comp = 0;
state.capture.forEach(function (p) { if (statusOf(p.count) === 'compliant') comp++; });
return { onsite: onsite, comp: comp, below: onsite - comp,
         pct: onsite ? Math.round(comp / onsite * 100) : 0 };
```

There is no exemption logic anywhere in the client. Every person the server
returns gets a row, a stepper, a place in the percentage and a line in the
Excel export.

### What it costs

Of 183 people returned on 4 Sept 2026, **35 hold roles that are not required
to complete a Take 5**. While those 35 log nothing, site compliance is capped
at **148 / 183 = 81%**. The site cannot reach 100% however well the crews
perform, and every crew rollup, trend point and supervisor notification
inherits the same distortion.

| | Headcount |
|---|---|
| Returned by `GetCapture` | 183 |
| Required to complete a Take 5 | **148** |
| Exempt (office / management / non-field) | **35** |

### Note on history

An earlier prototype (`take5compliance_7.html`) carried exactly this concept —
`EXEMPT_ROLE_RE`, `defaultRequired()`, `requiredOf()` and an
"Exempt (not required)" status — and it was dropped when the page was built
into Site Diary R4. This specification restores it and moves it server-side.

---

## 2. Why this has to be fixed on the server

The Daily Capture tab could be corrected in the browser, but the Dashboard tab
could not. `/Take5/GetDashboard` returns pre-computed aggregates:

`CompliantPct`, `OnSiteCount`, `ToActionCount`, `RosterCount`, `OnLeaveCount`,
`RangeTagTotal`, `AvgPerWorker`, `OnSiteDayCount`, `CompliantDayCount`,
`ActionList`, `CrewRollup`, `Trend`

The browser cannot recompute worker-days or trend history from what it is
given. A client-only patch would fix the capture percentage and leave every
dashboard number, the action list, the crew rollup, the trend chart, the PDF
and the supervisor email still wrong.

**Fix it once in the query that both endpoints share and everything downstream
corrects itself.**

---

## 3. Classification rules

The personnel record exposes **no occupation category and no staff/field
flag** — only a free-text `Role` string. Confirmed against the live payload:

```
"fieldsServerSends": [ "EmployeeId", "Name", "Gender", "Role", "Crew",
                       "Company", "OnSite", "TagCount", "Status" ]
```

So classification is by pattern match on `Role`, with a per-person override.

### Agreed with HSE

**EXEMPT — not required to complete a Take 5**

| Pattern (word-bounded, on the normalised role) | Roles matched on 10265 | n |
|---|---|---|
| `supervisor` | Supervisor ×6, Supervisor - Workshop ×3, Supervisor - Senior ×1 | 10 |
| `engineer` | Engineer - Project ×6, Engineer - Site ×1 | 7 |
| `advisor` | HSE Advisor ×3, HSE Advisor - Senior ×2, Environmental & Sustainability Advisor ×1 | 6 |
| `manager` | Construction ×1, Commercial ×1, Area ×1, Project ×1 | 4 |
| `administrat` (stem) | Site Administrator ×2, Contracts Administrator ×1, Contracts Administrator- Senior ×1, Maintenance Administrator - Senior ×1 | 5 |
| senior surveyor | Surveyor - Senior ×2 | 2 |
| `superintendent` | Superintendent ×1 | 1 |
| | **Total exempt** | **35** |

**REQUIRED — everyone else (148).** Explicitly including, because each was
raised and confirmed: **Surveyor** ×7, **Soil Technician** ×4, **Peggy** ×2,
**Leading Hand** ×1, **Traffic Controller** ×2, plus all operators, mechanics
and trades.

### Two rules that are easy to get wrong

1. **`Surveyor` is required but `Surveyor - Senior` is exempt.** A plain
   substring match on `surveyor` catches both. The senior-surveyor test must
   run first, and must not assume word order — `Senior Surveyor` reads the
   same way.
2. **The role data contains typos.** `"Operator - Side Tipper "` has a
   trailing space; `"Contracts Administrator- Senior"` is missing one.
   Matching must fold case and collapse runs of non-alphanumerics, or those
   rows slip into the wrong bucket. A hand-maintained list of exact strings
   would break the first time somebody fat-fingers a title.

### Unknown roles fail safe towards required

A role matching nothing is treated as **required**. An unrecognised title then
shows up in the report and gets questioned, rather than silently vanishing
from the denominator — which is the failure we are fixing. New office titles
are still caught by the stems: `Site Supervisor`, `Administration Officer` and
`Engineer - Graduate` all classify as exempt without any change.

---

## 4. Server-side implementation

Reference implementation and full test suite:

- `src/take5-role-classification.js` — the logic, ES5, no dependencies
- `src/take5-role-classification.test.js` — 60+ assertions over the real
  183-person census, including both typos (`node src/take5-role-classification.test.js`)

Equivalent C#:

```csharp
public static class Take5RoleRules
{
    // Senior surveyors are exempt but surveyors are not, so this is tested
    // first. Word order is not assumed.
    private static readonly Regex SeniorSurveyor = new Regex(
        @"\bsurveyor\b.*\bsenior\b|\bsenior\b.*\bsurveyor\b",
        RegexOptions.Compiled);

    // `administrat` is a deliberately unbounded stem so it covers
    // Administrator, Administration and Administrative alike.
    private static readonly Regex Exempt = new Regex(
        @"\bsupervisor\b|\bsuperintendent\b|\bengineer\b|\bmanager\b|administrat|\badvisor\b",
        RegexOptions.Compiled);

    private static readonly Regex NonAlnum = new Regex(@"[^a-z0-9]+", RegexOptions.Compiled);

    /// Folds case and collapses separators so the two known typos in the
    /// source data ("Operator - Side Tipper ", "Contracts Administrator- Senior")
    /// cannot change the classification.
    public static string NormaliseRole(string role) =>
        NonAlnum.Replace((role ?? string.Empty).ToLowerInvariant(), " ").Trim();

    /// The default requirement for a role, before any per-person override.
    /// An unrecognised role returns true so it surfaces in the report.
    public static bool DefaultRequired(string role)
    {
        var n = NormaliseRole(role);
        if (n.Length == 0) return true;
        if (SeniorSurveyor.IsMatch(n)) return false;
        return !Exempt.IsMatch(n);
    }

    /// The effective requirement: an explicit override always wins.
    public static bool IsRequired(string role, bool? overrideValue) =>
        overrideValue ?? DefaultRequired(role);
}
```

### Where to apply it

1. **`GetCapture`** — add `Required` (bool) to each row. Keep returning
   exempt personnel; do not filter them out (see §5).
2. **`GetDashboard`** — count a person towards `CompliantPct`,
   `OnSiteCount`, `ToActionCount`, `OnSiteDayCount`, `CompliantDayCount`,
   `AvgPerWorker`, `CrewRollup`, `Trend` and `ActionList` **only when
   `OnSite && Required`**. Add `ExemptCount` so the UI can show what was
   excluded. Historic trend points must be recomputed under the same rule or
   the chart will show a step change on the deploy date.
3. **`Notify`** — the supervisor email is built from `ActionList`, so it
   corrects itself once `ActionList` is filtered. This is a live complaint:
   on 4 Sept the action list held 129 names and included office personnel
   (e.g. crews "Site Office - A Crew" and "Site Office HS - B Crew"), all of
   whom went into the "Notify supervisors" email. `take5.js` does not choose
   who is in that email — `notifyBodyText()` only formats `ActionList` —
   so there is nothing to change client-side.

   Consider also a threshold on `ActionList` (e.g. below minimum on 3+ days
   in range) so the email stays actionable: at 30% compliance an unfiltered
   list is most of the site, and supervisors will stop reading it.

### Per-person override

Pattern matching on free text will occasionally be wrong, and roles change
without the title changing. Add a small store keyed on employee and project:

| Column | Type | Note |
|---|---|---|
| `EmployeeId` | int | |
| `ProjectId` | int | |
| `Required` | bit | explicit true or false; absent row means use the role default |
| `SetBy`, `SetUtc` | | who overrode it and when — this is auditable safety data |

Return the resolved value as `Required` on each row and let HSE toggle it from
the capture screen. `POST /Take5/SetRequired { EmployeeId, Required }`.

---

## 5. Keep exempt personnel visible, do not filter them out

They should stay on the capture list, marked "Exempt — not required" and
excluded from the percentage, rather than disappearing. Three reasons:

- **Audit.** You can show an auditor the person was on site and was correctly
  excluded. A filtered list cannot prove anything about who is missing.
- **Exceptions.** A supervisor doing field work that day needs to be flipped
  to required, which is impossible if they are not on the screen.
- **Verification.** Role matching on free text is fallible by nature. If a
  misclassification is invisible, nobody ever catches it.

This is how the v7 prototype behaved, and the reasoning still holds.

---

## 6. Client changes (`take5.js`) — done, deployable now

`src/take5.js` is a drop-in replacement for `/js/take5.js` that applies the
classification in the browser. See `docs/deploying-take5-js.md`. It corrects
everything the page can correct from the data it already receives:

- Daily Capture: exempt rows visible but muted, no stepper, out of the %;
  `OnSite` and `Status` now mapped and honoured; Excel gets a `Required` column
- Dashboard hero, action list, **Notify supervisors**, compliance by crew,
  leaderboards, lookup, running totals and the dashboard Excel: recomputed
  from `TableRows` over required people, with the exempt count shown
- Per-person override from the capture list (browser-local until §4's
  endpoint exists)

It cannot fix the **trend chart**, whose per-period percentages arrive
pre-computed, and it labels that chart as still including exempt roles. The
server-side change in §4 removes that caveat and makes overrides shared. Once
the server sends `Required` on each row, the client should prefer it over its
own classification — a one-line change in `requiredOf()`.

---

## 7. Scope check — one bug, not two

It was initially unclear whether `GetCapture` returned the whole roster or
only the day's on-site personnel, since the payload carries an `OnSite` field
that `take5.js` maps out of existence before counting every row as present:

```js
state.capture = rows.map(function (r) {
    return { employeeId: …, name: …, gender: …, role: …, crew: …, company: …,
             count: P(r, 'TagCount') || 0 };   // OnSite and Status dropped
});
```

The dashboard for 4 Sept settles it: **"On site in range: 184 · 0 on leave ·
184 on prestart."** The list is the prestart, not the roster, so people on
leave are not inflating the denominator. The exempt-role problem is the
whole problem.

Two things IT should still confirm:

- **"0 on leave" on a 184-person project looks wrong.** Either the roster's
  leave flag is not reaching Take 5, or it is genuinely zero that day.
- `take5.js` should still map `OnSite` and honour it (§6). It costs nothing
  and guards the capture tab if the endpoint's behaviour ever changes.

### How much of the low compliance is this defect?

Not most of it. On 4 Sept: 55 of 184 worker-days compliant (30%), average
1.1 tags per worker-day against a target of 3.0. Removing the ~35 exempt
personnel moves the figure to roughly 55 of 149 — about **37%**. The defect
is worth ~7 percentage points and a hard 81% ceiling; the remaining gap is
genuine under-reporting by the crews. Both are worth fixing, but the
denominator fix should not be presented as an explanation for the low
number.

---

## 8. Acceptance

- [ ] Capture tab shows 148 required, 35 exempt for 10265 on a full-roster day
- [ ] Compliance % on both tabs uses the 148 denominator
- [ ] `Surveyor` counted; `Surveyor - Senior` not
- [ ] Both typo'd roles classify correctly
- [ ] A per-person override survives a page reload and is attributed
- [ ] Trend history recomputed — no step change on the deploy date
- [ ] Supervisor email lists only required personnel
- [ ] Excel and PDF exports agree with the screen
