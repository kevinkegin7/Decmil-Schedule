# Current production system — reference copies

Files pulled from the live Site Diary R4 application on 4 Sept 2026, kept
here as the baseline for the Take 5 compliance work. These are *reference
copies*, not the deployed source — the deployed source lives in the IT
team's repository for `sdr10265ui`.

| File | Origin |
|---|---|
| `take5.js` | `/js/take5.js?v=PG7HcC8_n9bySpJWKwXHjQq9MxlC8gKG317x6lEXbYk` |

The Take 5 screen is rendered entirely by `take5.js`; the Razor page itself
ships only two empty mount points (`#t5Capture`, `#t5Dashboard`). The data
comes from `/Take5/GetCapture`, `/Take5/GetDashboard`, `/Take5/SaveCount`
and `/Take5/Notify`.

See `docs/take5-role-exemption-spec.md` for the outstanding defect.
