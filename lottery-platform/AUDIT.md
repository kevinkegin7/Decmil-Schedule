# Lottery Intelligence Platform — Repository Intelligence Audit

| | |
|---|---|
| **Audit date** | 2026-11-28 |
| **Repository** | `kevinkegin7/Decmil-Schedule` |
| **Branch audited** | `claude/lottery-platform-audit-odsni9` (identical to `main` @ `8e0d3bf`) |
| **Author role** | Claude Code — implementation engineer |
| **Status** | Audit complete. **No implementation started.** Awaiting owner review of §1 decisions. |

---

## 0. Executive summary

1. **This repository contains no lottery code, data, schema or dependencies.** It is a
   Decmil HSE workplace tool: a personal shift-schedule dashboard (`index.html`, "DECNET")
   and a Take 5 safety-compliance module for the Site Diary R4 application (`src/take5.js`).
   Every one of the platform's capabilities is a **greenfield build**. Nothing in the
   existing application code is reusable for the lottery domain; only engineering
   *patterns* (Playwright browser tests against a mock API and fixtures) carry over.
2. **This is the wrong repository for the product.** It holds an employer's operational
   tooling, a live Firebase project configuration for `decmil---hseq`, and personal
   identifiers. Mixing a commercial gambling-adjacent product into it creates IP-ownership,
   confidentiality and access-control risk. **Recommendation: create a dedicated repository**
   (owner decision D1).
3. **The game set implies Western Australia.** Millionaire Medley and Cash 3 are Lotterywest
   products. Rules, draw schedules and availability differ by state, so the platform must
   be jurisdiction-aware (owner decision D2).
4. **Official sources are unreachable from this environment** (`lotterywest.wa.gov.au`,
   `cdn.sanity.io` both blocked by network policy). The rules registry in §6 is therefore
   marked per-field with its verification status. Nothing marked UNVERIFIED may be coded
   as fact.
5. **Scientific position.** Draws are independent and (by regulation) uniformly random.
   No strategy derived from history can change the probability of winning any division.
   The product is credible only if it is positioned as *transparent analytics,
   cost/return tracking and honest experimentation* — and it can then demonstrate, with
   its own experiment framework, that prediction does not work. The one legitimate lever
   on expected *return* is **prize-sharing avoidance** (choosing combinations other people
   pick less often), which changes payout-per-win in pari-mutuel divisions, not win
   probability (§10).
6. **Existing app has security issues worth fixing independently** (§4): LLM provider API
   keys stored in browser `localStorage` and sent directly from the browser; Firebase
   Realtime Database security rules not in the repo and unverifiable; a `.zip` file that
   is actually an HTML document.

---

## 1. Decisions that genuinely need the owner

| # | Decision | Recommendation | Why it is yours |
|---|---|---|---|
| D1 | Where the product lives | New private repo (e.g. `lottery-intelligence`), with this audit moved there | Ownership/IP, and it separates employer and personal work |
| D2 | Jurisdiction(s) | WA / Lotterywest first; registry designed for multi-jurisdiction | Determines which rules, prices and results are authoritative |
| D3 | Results data rights | Obtain written permission or a licensed feed before automated collection; manual/CSV import until then | Legal exposure; terms of use could not be read from here |
| D4 | Network access for official sources | Allow `www.lotterywest.wa.gov.au`, `lotterywest.wa.gov.au`, `cdn.sanity.io` (and The Lott if multi-state) in the cloud environment | Changes what the environment can reach |
| D5 | Hosting and budget | Managed Postgres + small container host; ~AUD 0–40/month at prototype scale | Spends money |
| D6 | Commercial positioning | "Analytics, tracking and experiments", never "prediction"; 18+ gate; responsible-gambling messaging; legal review before charging customers | Australian Consumer Law misleading-conduct risk, gambling advertising rules |

Until D1 is answered, this audit is committed on the development branch only, in an
isolated `lottery-platform/` folder that touches no existing file.

---

## 2. Repository inventory (what actually exists)

### 2.1 Files

| Path | Lines | What it is |
|---|---|---|
| `index.html` | 932 | "DECNET · DECMIL" single-file shift dashboard: roster, tasks, Firebase sync, three.js visuals, RSS news, Gemini/Claude/OpenAI chat and email-to-task extraction |
| `src/take5.js` | 1135 | Patched Take 5 compliance screen (role-exemption fix) for Site Diary R4 |
| `src/take5-role-classification.js` (+ `.test.js`) | 133 / 148 | Role-string → required/exempt classifier and its unit tests |
| `current-system/take5.js` | 921 | Reference copy of the production file before the patch |
| `test/` | 439 | Playwright browser harness, mock API, 183-person fixture |
| `docs/` | 384 | Take 5 exemption spec and deployment guide |
| `Automated compliance tracking system.zip` | — | **Mislabelled: it is an HTML document, not a zip** |
| `package.json` | — | `decmil-take5-compliance`, one devDependency (`jquery`) |

### 2.2 Git history

34 commits. ~28 are web-UI uploads titled "Update index.html" (no review trail), followed by
PR #1 (Take 5 role exemption fix) merged 2026-09-06. No tags, no CI, no releases, no
lottery-related commit at any point.

### 2.3 Dependencies and services

| Kind | Item | Notes |
|---|---|---|
| npm (dev) | `jquery ^3.7.0` | Only used by the browser test harness |
| CDN | Firebase JS SDK **8.10.1**, three.js **r128**, Google Fonts | Firebase v8 is legacy (namespaced API); three r128 is from 2021 |
| SaaS | Firebase Realtime DB `decmil---hseq` (asia-southeast1) | Rules not in repo |
| SaaS | Gemini, Anthropic, OpenAI APIs called from browser | Keys from `localStorage` |
| SaaS | `api.rss2json.com` proxy for BBC/ABC/Reuters feeds | Third-party dependency; Reuters feed URL is long-deprecated |

### 2.4 Tests actually executed during this audit

| Command | Result |
|---|---|
| `npm test` (before `npm ci`) | **FAIL** — browser suite times out waiting for `#t5List .wrow` because `node_modules/jquery` is absent. Unit tests passed. |
| `npm ci && npm test` | **PASS** — unit: "All checks passed" (40 roles, 148 required, 35 exempt); browser: all checks passed, "no uncaught page errors" |

Defect: the browser test fails with a misleading timeout instead of "run `npm ci`". Low
severity, not fixed (out of scope; no code changes in this milestone).

---

## 3. Reuse assessment

| Existing asset | Reusable for lottery platform? |
|---|---|
| Application code (`index.html`, `take5.js`) | **No** — different domain, single-file architecture, globals, no modules |
| Firebase project | **No** — belongs to an employer HSE project; never co-locate |
| Test pattern: Playwright + mock API + deterministic fixture + "no uncaught page errors" check | **Yes, as a pattern** |
| Spec-first docs style (`docs/take5-role-exemption-spec.md`: problem, evidence, numbers, rules) | **Yes, as a pattern** |
| Mobile-responsive CSS approach | Marginal |

Conclusion: nothing to migrate. Greenfield in a new repository loses nothing.

---

## 4. Security and configuration review (existing code)

Reported because the owner should know; **none of these were changed**.

| Sev | Finding | Detail | Recommendation |
|---|---|---|---|
| High | LLM API keys in browser storage | `getKey(b) → localStorage['key_'+b]`; calls Anthropic with `anthropic-dangerous-direct-browser-access`. Any XSS or third-party script (CDN, rss2json content) can read the keys | Move AI calls behind a server-side proxy holding the keys; never ship keys to the browser |
| Medium | Firebase RTDB rules unknown | Web config (`apiKey`, `databaseURL`) is committed. Firebase web API keys are identifiers, not secrets — **safety depends entirely on database rules**, which are not in the repo | Export rules into the repo, confirm auth is required; add App Check |
| Medium | Personal/employer data in prompts | `buildContext()` sends name, employer, project number and task list to three AI providers | Confirm this is allowed by employer policy |
| Low | Third-party RSS proxy | Feed content via `rss2json` rendered into the page | Ensure it is escaped, not set via `innerHTML` |
| Low | Legacy SDKs from CDN without SRI | Firebase 8.10.1, three r128 | Pin with Subresource Integrity or bundle |
| Low | Mislabelled `.zip` | HTML file named `.zip` | Rename to `.html` or remove |

Historical secret scan: `git log -p --all` searched for Google (`AIza…`), OpenAI (`sk-…`) and
Anthropic (`sk-ant-…`) key patterns. Only the Firebase web key matched; no LLM provider keys
were ever committed.

---

## 5. Gap assessment against the mission

Every capability is **absent (0%)**. The table instead ranks the gaps by difficulty and
by what is likely to fail if handled naively.

| Capability | Hidden difficulty / risk |
|---|---|
| Historical results database | Rule formats change over time (Oz Lotto 7/45→7/47 and 3 supps in 2022; Powerball 2018; Set for Life format change 2026). Each draw must be validated against the **rule version in force on its date**, not today's |
| Official results ingestion | Data rights unknown (D3); network blocked (D4); site HTML changes break parsers silently |
| Validation and reconciliation | Needs ≥2 independent sources; corrections must be revisions, never overwrites |
| Statistical analysis | Easy to produce misleading "hot/cold" charts. Must be framed as descriptive plus randomness tests |
| Portfolio generation | Cannot be "better" at winning. Honest options: uniform random, user-chosen, popularity-avoiding, coverage designs (variance, not EV) |
| Portfolio management | Locked portfolios must be tamper-evident (hash + timestamp before draw close) |
| Historical backtesting | Data leakage (strategy seeing the draw it is scored on) is the main correctness risk |
| Prospective tracking | Needs a trustworthy lock time and immutable lines |
| Prize validation | Pari-mutuel divisions need **per-draw dividend data**, not only winning numbers. Fixed-prize games (Cash 3) need the bet-type payout table |
| Cost and return tracking | Prices change; store the price per rule version and per entry |
| Analytics dashboard | Must work on iPhone; charts need accessible uncertainty display |
| Reproducible experiments | Every run must record code commit, data snapshot hash, seed, rule versions |

Missing components that apply to all seven games: rules registry, prize engine,
draw schedule calendar, ingestion adapters, reconciliation queue, dividend store,
experiment registry, auth, audit log, CI.

---

## 6. Seven-game rules registry (draft)

**Verification legend**
- **V-calc** — confirmed by independent combinatorial calculation matching a published odds figure.
- **V-search** — stated in an official-domain search snippet (Lotterywest) seen during this audit; page itself not readable.
- **UNVERIFIED** — engineer's prior knowledge only. **Must be confirmed against the official game rules before being coded.**

| Game | Matrix | Draws (WA) | Divisions | Status |
|---|---|---|---|---|
| **Saturday Lotto** | 6 main from 1–45, 2 supplementary from same barrel | Saturday | 6: 6 / 5+S / 5 / 4 / 3+S / (1 or 2)+2S | UNVERIFIED |
| **Powerball** | 7 main from 1–35 + 1 Powerball from separate 1–20 barrel (Div 1 odds 1 in 134,490,400 by calculation) | Thursday | 9: 7+PB / 7 / 6+PB / 6 / 5+PB / 4+PB / 5 / 3+PB / 2+PB | UNVERIFIED |
| **Oz Lotto** | 7 main from 1–47, 3 supplementary (format since 2022) | Tuesday | 7: 7 / 6+S / 6 / 5+S / 5 / 4 / 3+S | UNVERIFIED |
| **Millionaire Medley** | 6 main from 1–45, 2 supplementary from same barrel; game line = 6 numbers; **minimum 3 lines** | Mon, Wed, Fri | 6: 6 / 5+1S / 5 / 4 / 3+1S / (1 or 2)+2S. Div 1 guaranteed $1M for up to 6 winners; 7+ winners share $6M | Matrix and Div 2/3 odds **V-calc** (1:678,755 and 1:36,690). Schedule, minimum, guarantee **V-search** |
| **Set for Life** | 7 main from 1–44 (matrix UNVERIFIED); "Bonus Numbers" renamed **Supplementary Numbers** in new format | Daily | Div 1 $20,000/month for 20 years (up to 4 winners per draw); **new Div 2 $5,000/month for 1 year** (up to 4 winners). Full division table UNVERIFIED | Div 1/2 annuity and supp rename **V-search**; effective date UNVERIFIED |
| **Cash 3** | 3 digits 0–9 | Daily, 5:00 pm | Fixed-odds bet types (straight/box-style), payout table UNVERIFIED | Draw time **V-search**; everything else UNVERIFIED |
| **Super 66** | 6 digits 0–9, order matters; $1 per game | Saturday, 6:00 pm | 5 divisions; Div 1 = all 6 in drawn order. Lower divisions believed to be first/last N digits — UNVERIFIED | Price, draw, 5 divisions, Div 1 **V-search** |

Registry design requirements (independent of the values above):

- **Versioned with effective dates.** `game_rule_version(effective_from, effective_to)`;
  every draw references the version it was played under.
- **Declarative.** Matrix and divisions expressed as data
  (`{main: {count, min, max}, supp: {count, barrel: "main"}, extra: {count, min, max}}`,
  divisions as match predicates), not if-statements. One generic engine evaluates them.
- **Self-checking.** For every version, the engine enumerates or computes exact division
  probabilities with exact integer arithmetic and asserts they equal the published odds.
  This is the mechanical gate that turns UNVERIFIED into V-calc.
- **Source-cited.** Each version stores the URL, retrieval date and SHA-256 of the
  official rules document it was taken from.

---

## 7. Recommended architecture

### 7.1 Options considered

| Option | Strengths | Weaknesses | Verdict |
|---|---|---|---|
| A. Static SPA + Firebase (current pattern) | Familiar to owner, cheap, realtime | No relational integrity or multi-row transactions for reconciliation; weak for analytical queries; security rests on rules files that are easy to get wrong; vendor lock-in | Reject |
| B. TypeScript full stack (Next.js + Postgres) | One language, strong typing, good mobile web | Statistical tooling (exact tests, multiple-comparison methods, random generators with reproducible streams) is thin and less trusted by reviewers | Viable |
| C. **Python core + Postgres + TypeScript PWA** | NumPy `Generator(PCG64)` reproducible streams; SciPy/statsmodels for tests and multiple-comparison corrections, which researchers trust; pure-Python rules/stats package testable without a web stack | Two languages | **Recommend** |

### 7.2 Recommended shape (option C)

```
lotto-core/   (pure Python package, no I/O)
   rules registry loader · prize engine · probability calculator
   generators (uniform, popularity-avoiding, coverage) · stats & tests
   experiment runner (seeded, leakage-safe data views)
api/          FastAPI · SQLAlchemy 2 · Alembic migrations · auth · RLS-aware queries
ingest/       source adapters → raw store → parse → validate → reconcile (scheduled job)
web/          React + Vite + TypeScript PWA, responsive; charts with uncertainty bands
db/           PostgreSQL 16 (system of record, append-only audit tables)
```

Key properties:

- **`lotto-core` is the scientific kernel.** It is deterministic, has no network or database
  access, and is the only code allowed to compute prizes or statistics. It can be audited,
  versioned and cited by commit hash.
- **The database is the system of record**, with constraints that reject invalid draws
  (number ranges, distinctness, counts) as a second line of defence after application
  validation.
- **Experiments are data.** Each run is a row with its inputs' hashes, so any number on
  the dashboard can be traced to code + data + seed.

---

## 8. Database schema (draft)

```sql
-- Reference ---------------------------------------------------------------
create table jurisdiction (code text primary key, name text not null);           -- 'WA'
create table game (
  id serial primary key, code text unique not null,                               -- 'SAT_LOTTO'
  name text not null, kind text not null check (kind in ('lotto','digit')));
create table game_rule_version (
  id serial primary key, game_id int not null references game,
  jurisdiction text not null references jurisdiction,
  effective_from date not null, effective_to date,
  spec jsonb not null,                       -- matrix, divisions, prices, bet types
  source_url text not null, source_sha256 text not null, retrieved_at timestamptz not null,
  verified_by text not null check (verified_by in ('official_doc','calc','unverified')),
  exclude using gist (game_id with =, jurisdiction with =,
                      daterange(effective_from, effective_to) with &&));

-- Results -----------------------------------------------------------------
create table draw (
  id bigserial primary key, game_id int not null references game,
  draw_number int not null, draw_date date not null,
  rule_version_id int not null references game_rule_version,
  status text not null check (status in ('quarantined','provisional','verified','corrected')),
  unique (game_id, draw_number));
create table draw_ball (
  draw_id bigint references draw, barrel text not null,           -- 'main','supp','powerball','digit'
  position smallint not null, value smallint not null,
  primary key (draw_id, barrel, position));
create table draw_dividend (
  draw_id bigint references draw, division smallint not null,
  winners int, prize_cents bigint, jurisdiction text references jurisdiction,
  primary key (draw_id, division, jurisdiction));

-- Provenance & reconciliation ---------------------------------------------
create table raw_document (                                       -- immutable
  id bigserial primary key, source text not null, url text,
  fetched_at timestamptz not null, sha256 text unique not null, body bytea not null);
create table ingestion_run (
  id bigserial primary key, source text not null, parser_version text not null,
  started_at timestamptz not null, finished_at timestamptz, outcome text, stats jsonb);
create table draw_observation (                                   -- one per source per draw
  id bigserial primary key, draw_key text not null, raw_document_id bigint references raw_document,
  ingestion_run_id bigint references ingestion_run, payload jsonb not null);
create table reconciliation_issue (
  id bigserial primary key, draw_key text not null, kind text not null,
  detail jsonb not null, opened_at timestamptz not null, resolved_at timestamptz,
  resolution text, resolved_by uuid);
create table draw_revision (                                      -- corrections never overwrite
  id bigserial primary key, draw_id bigint references draw, revised_at timestamptz not null,
  before jsonb not null, after jsonb not null, reason text not null, actor uuid);

-- Users, portfolios, entries ----------------------------------------------
create table app_user (id uuid primary key, created_at timestamptz not null, age_confirmed_at timestamptz);
create table portfolio (id uuid primary key, owner_id uuid not null references app_user,
  game_id int not null references game, name text not null);
create table portfolio_version (                                  -- immutable once locked
  id uuid primary key, portfolio_id uuid not null references portfolio,
  strategy text not null, strategy_params jsonb not null, seed bigint,
  generator_version text not null, core_commit text not null,
  created_at timestamptz not null, locked_at timestamptz,
  lock_sha256 text);                                               -- hash of canonical lines
create table portfolio_line (
  portfolio_version_id uuid references portfolio_version, line_no int,
  numbers smallint[] not null, extra smallint[], bet_type text, stake_cents int,
  primary key (portfolio_version_id, line_no));
create table entry (                                              -- a version played in a draw
  id uuid primary key, portfolio_version_id uuid not null references portfolio_version,
  draw_id bigint not null references draw, cost_cents bigint not null,
  mode text not null check (mode in ('real','paper')),
  unique (portfolio_version_id, draw_id));
create table entry_result (
  entry_id uuid references entry, line_no int, division smallint,
  prize_cents bigint, evaluated_with_rule_version int references game_rule_version,
  evaluated_at timestamptz not null, primary key (entry_id, line_no));

-- Experiments -------------------------------------------------------------
create table experiment (                                         -- pre-registered
  id uuid primary key, owner_id uuid references app_user, title text not null,
  hypothesis text not null, primary_metric text not null,
  strategies jsonb not null, baseline text not null,
  train_window daterange, test_window daterange not null,
  alpha numeric not null, correction text not null check (correction in ('holm','bh','bonferroni')),
  registered_at timestamptz not null, registration_sha256 text not null);
create table experiment_run (
  id uuid primary key, experiment_id uuid references experiment,
  core_commit text not null, data_snapshot_sha256 text not null, seed bigint not null,
  n_simulations int not null, results jsonb not null, started_at timestamptz, finished_at timestamptz);

create table audit_log (id bigserial primary key, at timestamptz not null, actor uuid,
  action text not null, target text not null, detail jsonb);
```

Row-level security: `portfolio*`, `entry*`, `experiment*` restricted to `owner_id`.
Results and rules are read-only to users; only the ingestion role writes them.

---

## 9. Historical data ingestion design

```
 source adapter ──► raw_document (immutable, sha256) ──► parser vN ──► draw_observation
                                                                          │
                                   validate against rule version for draw date
                                     (counts, ranges, distinctness, barrel rules,
                                      draw date on schedule, draw number sequence)
                                                                          │
                             ┌──── fail ────► quarantined + reconciliation_issue
                             │
                     reconcile with second source ── agree ──► verified
                                                    └─ disagree ─► reconciliation_issue
```

- **Source priority** (subject to D3): (1) licensed/official feed; (2) official results pages,
  only if their terms permit automated access, rate-limited, identified with a generic user
  agent; (3) official downloadable archives; (4) manual CSV import with two-person/two-pass entry.
- **Idempotent**: re-running a fetch with the same `sha256` is a no-op.
- **Never overwrite**: corrections write `draw_revision`, re-evaluate affected `entry_result`
  rows and log both.
- **Parser drift detection**: a parser that suddenly yields zero rows or a schema mismatch
  fails the run loudly; it must not "succeed with nothing".
- **Backfill** runs once per game from the oldest available official draw; the earliest
  draw for each rule version is recorded so analyses never span incompatible formats
  without saying so.
- **Freshness monitor**: expected next draw date from the schedule; alert if not ingested
  within N hours.

---

## 10. Scientific integrity framework

### 10.1 What the platform will and will not claim

| Claim | Allowed? |
|---|---|
| "Number X has appeared N times" (descriptive, with expected count and CI) | Yes |
| "These draws are consistent with uniform randomness (p = …)" | Yes — this is a genuine audit service |
| "Strategy S outperformed random" | Only after a pre-registered, out-of-sample test that survives multiple-comparison correction **and** independent replication |
| "Hot/cold/due numbers" as advice | **No** |
| "Increase your chance of winning" | **No** — mathematically false for any selection strategy |
| "Reduce the chance of sharing a prize" | Yes, with evidence — popularity avoidance changes payout-per-win, not win probability |

### 10.2 Experimental controls

- **Uniform baseline**: every strategy is compared with N equally-sized portfolios drawn
  uniformly at random with recorded seeds (NumPy PCG64, `SeedSequence` spawning so each
  strategy/replicate has an independent, reproducible stream).
- **Exact null distributions** where possible: for a portfolio of L lines, hit counts per
  division follow known hypergeometric distributions; use exact values rather than simulation
  when available.
- **Leakage prevention**: strategies receive a `HistoryView` object constructed with a cutoff
  date; it physically contains no draw at or after the target. A test asserts that every
  strategy run against draw *t* receives a view whose max date < date(*t*).
- **Out-of-sample**: train/test windows are fixed at registration; walk-forward evaluation
  for any strategy that "learns".
- **Pre-registration**: hypothesis, metric, strategies, windows, α and correction are hashed
  and timestamped before any test-window result is computed.
- **Multiple comparisons**: Holm (FWER) by default; Benjamini–Hochberg when exploratory.
  The dashboard shows the number of hypotheses tested.
- **Uncertainty**: every rate shown with an interval (Wilson / Clopper–Pearson); returns
  shown with bootstrap intervals; heavy-tailed prize distributions noted.
- **Prospective lock**: portfolio lines hashed (`lock_sha256`) and `locked_at` recorded
  before the draw's sales close; the hash can be published/shared to prove no edits.
- **Replication**: an apparent effect must recur on a disjoint later window, with a new seed,
  before the dashboard labels it anything other than "not significant after correction".

### 10.3 Randomness tests on official draws

Chi-square goodness-of-fit per ball position and overall; pair-frequency test; runs and gap
tests; Kolmogorov–Smirnov on sums against the exact sum distribution. These double as
**data-quality checks** — a transcription error often shows up as an impossible or extreme value.

---

## 11. Testing methodology

| Layer | Method |
|---|---|
| Rules registry | For every rule version, compute exact division probabilities with integer combinatorics and assert equality with the official odds table |
| Prize engine | Exhaustive enumeration where feasible (Cash 3: 1,000 outcomes; Super 66: 10⁶) against an independently written oracle; hand-computed fixtures for lotto games; property tests (Hypothesis) — e.g. permuting a line never changes its division in lotto games |
| Generators | Statistical uniformity tests over ≥10⁶ samples with fixed seed; same seed ⇒ byte-identical output across runs and machines |
| Statistics | Known-answer tests against textbook/SciPy reference values; simulated null data must give p-values ≈ Uniform(0,1) |
| Leakage | Tests that try to read future draws through `HistoryView` must fail |
| Ingestion | Golden raw documents stored as fixtures; parser snapshot tests; deliberately corrupted fixtures must quarantine |
| Reconciliation | Two-source disagreement fixtures produce issues, never silent picks |
| Independent fixtures | A set of real historical draws and dividends hand-transcribed from official PDFs by a second person, never generated by the code under test |
| API | Contract tests; RLS tests proving user A cannot read user B's portfolios |
| UI | Playwright on iPhone 15, iPad and desktop viewports; accessibility checks; "no uncaught page errors" pattern from this repo |
| CI | Every push: lint, type-check, unit, property, integration (Postgres container), E2E smoke |

---

## 12. Security model

- **Identity**: managed OIDC provider or passkeys; no home-grown password storage. 18+ confirmation recorded.
- **Authorisation**: Postgres row-level security keyed to `owner_id`, plus API checks.
- **Secrets**: server-side only, from the host's secret manager; never in the repo or the browser.
  Pre-commit secret scanning and GitHub secret scanning enabled.
- **Integrity**: append-only raw documents, revisions and audit log; locked portfolios hashed.
- **Web**: strict CSP, no third-party script without SRI, output encoding, CSRF protection on
  cookie sessions, rate limiting on auth and ingestion triggers.
- **Supply chain**: lockfiles, Dependabot/Renovate, `pip-audit` / `npm audit` in CI.
- **Privacy**: Australian Privacy Principles; minimal personal data (no need to store real
  ticket serials); data export and deletion on request.
- **Operations**: daily encrypted backups with tested restore; separate prod and dev databases;
  production deployment only with owner approval.

---

## 13. Phased implementation plan

| Phase | Scope | Exit criteria (all must be executed, not just written) | Blocked by |
|---|---|---|---|
| **0** | Owner decisions D1–D6; new repo; CI skeleton | Repo exists, CI green on empty project | Owner |
| **1** | `lotto-core`: declarative rules registry, prize engine, exact probability calculator | All seven games' rule versions pass the odds-equality test against **official** documents; exhaustive tests for digit games | Official rules (D4) |
| **2** | Postgres schema + Alembic migrations; CSV/manual import; validation | Invalid draws rejected by both app and DB constraints; migrations up/down tested | Phase 1 |
| **3** | Ingestion adapters, raw store, reconciliation, freshness monitor | Backfill for one game reconciled against a second source with zero unexplained issues | D3, D4 |
| **4** | Statistics: descriptive analytics, randomness test suite, uniform generator | Null-calibration tests pass; randomness report for each game | Phase 2 |
| **5** | Portfolios, locking, prospective tracking, cost/return (paper and real) | Lock hash verifiable; results auto-evaluated after ingestion | Phases 2–4 |
| **6** | Experiment framework: pre-registration, backtests, baselines, corrections, replication | Leakage tests pass; a demonstration experiment reproduces bit-for-bit from its record | Phase 5 |
| **7** | Responsive PWA dashboard | Playwright passes on phone/tablet/desktop; accessibility audit | Phases 4–6 |
| **8** | Auth, RLS, hardening, security review, backups | Independent security review; restore drill | Phase 7 |
| **9** | Commercial readiness | Legal review of claims and data rights; responsible-gambling content | D6 |

Recommended first approved milestone: **Phase 1**, because it is pure, offline, fully
testable, and every later phase depends on prize correctness.

---

## 14. Disagreements and challenges to the brief

1. **"Number portfolio generation" and "strategy comparison" cannot produce a winning edge.**
   Building them is still worthwhile — as the instrument that *demonstrates* this to customers.
   Marketing must not imply otherwise.
2. **"Statistical analysis" of frequencies invites gambler's-fallacy features.** Descriptive
   frequencies will always be shown next to their expected values and an uncertainty band.
3. **The commercially defensible differentiators** are: verified, provenance-tracked results;
   correct automatic prize checking; honest spend/return tracking; randomness audits; and
   prize-sharing-aware selection. These should lead the product pitch.
4. **This repository should not host the product** (D1).

---

## 15. Known limitations of this audit

- Official rule documents could not be read (network policy). §6 values marked UNVERIFIED are not facts.
- Data-licensing and terms-of-use position for The Lott / Lotterywest results is **unknown**.
- Firebase rules and production configuration of the existing app were not inspected (not in repo).
- No lottery code was written, so no lottery functionality is tested. **NOT TESTED: everything in §5–§13.**

## Sources consulted

- Lotterywest, Millionaire Medley — https://www.lotterywest.wa.gov.au/games/millionaire-medley (search snippet only)
- Lotterywest, "A guide to our games, effective from 14 September 2026" — https://cdn.sanity.io/files/cabqvweh/lw-corp-production/97241028a689ab84b14fada4a9226e92e277d9b3.pdf (fetch blocked)
- Lotterywest, Set for Life changes — https://www.lotterywest.wa.gov.au/new-setforlife (search snippet only)
- Lotterywest, Super66 — https://lotterywest.wa.gov.au/games/super66 (search snippet only)
- Oz Lotteries, Millionaire Medley — https://www.oz.lotterywest.com/millionaire-medley (search snippet only)
