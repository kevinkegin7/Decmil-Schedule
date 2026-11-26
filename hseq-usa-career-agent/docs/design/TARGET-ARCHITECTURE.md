# HSEQ USA Career Agent — Technical Architecture

Status: **Milestone 0 draft for review** · Last updated 2026-11-26

## 1. Purpose and scope

A private, single-user platform that helps an Australian Senior HSEQ Advisor find
US employment. It finds employers and vacancies, assesses employment-based
immigration pathways, drafts outreach and replies, and tracks applications and
offers. **The agents propose and a human decides. Only deterministic code acts.**

### Out of scope

- **Legal advice.** Immigration output is research with citations, labelled for
  attorney review. The platform never files anything with USCIS, DOL or DOS.
- **Auto-filling ATS forms or applying on the user's behalf.** The platform
  prepares material; the user submits it.
- **Scraping LinkedIn** or other sites whose terms forbid it.
- **Guessing email addresses** from name patterns (see ADR-005).
- **Bulk or marketing email.** Hard caps are built into the database (§8).

## 2. System overview

```
                        ┌──────────────────────────────────────────────┐
  User (phone/desktop)  │ Next.js app (App Router, TypeScript)          │
  ───── HTTPS ────────▶ │  • Dashboard pages  • Server Actions          │
   Supabase Auth + MFA  │  • Approval UI (shows exact content + hash)   │
                        └──────────────┬───────────────────────────────┘
                                       │ user JWT (role=authenticated)
                                       ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │ Supabase Postgres (ap-southeast-2)                                     │
 │  RLS · safeguard triggers · approvals · send gate · kill switches      │
 │  append-only hash-chained audit_log · agent_tasks queue                │
 └───────▲──────────────────────────▲───────────────────────────▲────────┘
         │ role=agent_worker        │ role=dispatcher           │ role=service_role
 ┌───────┴────────────┐     ┌───────┴──────────────┐    ┌───────┴─────────────┐
 │ Agent worker       │     │ Dispatcher            │    │ Ops jobs            │
 │ 6 agents, Claude   │     │ no LLM; sends only    │    │ DOL/USCIS data      │
 │ API, read + draft  │     │ approved mail; syncs  │    │ import, platform    │
 │ tools only         │     │ inbound mail          │    │ kill switch         │
 └───────┬────────────┘     └───────┬──────────────┘    └─────────────────────┘
         │                          │
         ▼                          ▼
  Claude API (Messages)      Gmail API / Microsoft Graph
  + web_search / web_fetch   (OAuth, least scopes, phased)
  ATS job board APIs
```

The three service processes each get their own JWT role, so the database can
tell them apart. The agent worker **cannot** send mail, record approvals,
change kill switches, verify profile facts, change work-authorisation status,
or move an application or offer into a binding state. These rules are enforced
by Postgres grants and triggers, not only by application code.

## 3. Technology

| Concern | Choice | Notes |
|---|---|---|
| Web | Next.js (current stable major, pinned at Milestone 1), App Router, TypeScript strict | Mobile-first, Tailwind + shadcn/ui |
| Validation | Zod | Shared schemas for forms, agent output, tool input |
| Database | Supabase Postgres 15+, region `ap-southeast-2` | RLS on every user table |
| Auth | Supabase Auth (Google, Microsoft, email) + **TOTP MFA required** | Approvals require `aal2` (Milestone 1) |
| File storage | Supabase Storage, private bucket, signed URLs | CVs, certificates, visa documents |
| Job queue | `agent_tasks` table + `claim_agent_task()` (`FOR UPDATE SKIP LOCKED`) | Triggered by Vercel Cron / Supabase cron |
| LLM | Claude API via `@anthropic-ai/sdk` | §5 |
| Mail | Gmail API, Microsoft Graph | §7 |
| Secrets | Vercel / Supabase env; OAuth refresh tokens AES-256-GCM encrypted in app | Key never stored in DB |
| Tests | Vitest (unit), Playwright (E2E), SQL safeguard suite (`supabase/tests`) | CI runs all three |
| Hosting | Vercel (web, cron routes) + a long-running worker for agent runs if needed | Worker can run on Fly.io/Render if runs exceed serverless limits |

## 4. Request roles and trust boundaries

| Role (JWT `role`) | Who | Can | Cannot |
|---|---|---|---|
| `authenticated` | The user, in the dashboard | Everything on their own rows; approve; verify facts; pause/resume; enable outbound | Send mail directly (only the dispatcher sends); change platform controls |
| `agent_worker` | The six agents | Read profile/employers/mail; create employers, jobs, contacts, evidence, assessments, **drafts**; classify mail | Approve, send, verify facts, change work auth, change controls, read OAuth tokens, set binding statuses |
| `dispatcher` | Mail sender + sync | Move **approved** messages through `sending → sent/failed`; store inbound mail | Create or edit message content; approve |
| `service_role` | Operator jobs, migrations | Reference data import; platform kill switch | Turn on a user's outbound email |
| *(no claims)* | Direct DB connection | — | Every privileged transition fails closed |

Untrusted inputs: inbound email, web pages, job postings, recruiter text. They are
**data, never instructions** (§5.5).

## 5. Agent design

### 5.1 Runtime pattern

The agents run on the **Messages API with code-orchestrated tool use** (ADR-002).
Each agent is a typed module:

```ts
interface AgentDefinition<I, O> {
  name: AgentName;                     // enum in DB
  model: string;                       // from config, default "claude-opus-5-5"
  effort: "low" | "medium" | "high" | "xhigh";
  system: string;                      // frozen; cached
  tools: AgentTool[];                  // read_* and propose_* only
  outputSchema: z.ZodType<O>;          // structured output, validated
  buildContext(input: I, db: AgentDb): Promise<AgentContext>;
}
```

A task runner claims a task, checks the kill switch, builds context, runs the
tool loop with a per-run token and tool-call budget, validates the output
against its schema, writes the results through the `agent_worker` role, and
records an `agent_runs` row (tokens, cache hits, cost, stop reason).

**Tool capability tiers.** `read_*` tools query. `propose_*` tools write drafts
or candidate records. **No `send_*`, `approve_*`, `submit_*` or `accept_*` tool
exists.** The model cannot take an external action because nothing it can call
does one.

### 5.2 The six agents

| Agent | Inputs | Tools (examples) | Outputs | Effort |
|---|---|---|---|---|
| **Career Director** | CV upload, user edits | `read_profile`, `propose_profile_fact` | Parsed employment, qualifications, skills as **unverified** facts; gap list; preference checks | high |
| **Employer Intelligence** | Preferences, industries, states | `web_search`, `fetch_ats_jobs` (Greenhouse/Lever/Ashby public APIs), `read_employers`, `propose_employer`, `propose_job` | Employers, vacancies, fit scores with rationale | medium |
| **Immigration Intelligence** | Profile, employer, job | `web_search`/`web_fetch` restricted to government domains, `query_dol_disclosures`, `propose_evidence`, `propose_pathway_assessment` | Evidence rows with source URL + retrieval time; pathway assessments citing sources | high |
| **Employer Outreach** | Target employer, published contact, verified facts | `read_verified_facts`, `read_employer`, `propose_outreach_draft` | Personalised draft + fact citations → `pending_approval` | high |
| **Email Negotiator** | New inbound mail | `read_thread`, `classify_message`, `propose_reply_draft`, `propose_action_item` | Classification + confidence; reply draft; follow-up schedule | low (classify) / high (reply) |
| **Application Manager** | Applications, interviews, offers, mail events | `read_applications`, `propose_action_item`, `propose_application_update` (non-binding statuses only) | Status updates, deadlines, interview prep, offer comparison | medium |

**Career Director** is the profile steward, not an LLM supervisor. Orchestration
is in code: task types, schedules and hand-offs (for example, "inbound offer
classified → Application Manager task") are explicit and testable.

### 5.3 Claude API usage

- **Model:** `claude-opus-5-5` for every agent by default. The model is a
  per-agent config value, so a cheaper model can be tried per route later once
  an eval shows quality holds (ADR-007).
- **Effort:** set explicitly per agent through `output_config.effort` (the
  default on this model is `medium`). Thinking is adaptive and always on; the
  code never sends `thinking: {type: "disabled"}` or `budget_tokens`, both of
  which return 400 on this model.
- **Structured output:** final agent results use `output_config.format` with
  JSON schemas generated from Zod, and are validated again before any DB write.
  Tools are declared `strict: true`. `tool_choice` stays `auto` (forced tool
  choice returns 400 on this model); the prompt names the tool to use.
- **Refusals:** every request checks `stop_reason` before reading content
  (`refusal`, `max_tokens`, `pause_turn`). Server-side fallback is enabled
  (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`), and
  the fallback model is recorded in `agent_runs`.
- **Streaming** is used for long runs, with `finalMessage()`; `max_tokens` is
  about 16k for non-streamed calls and about 64k for streamed ones.
- **Prompt caching:** prefix order is tools → frozen system prompt → **verified
  profile snapshot** (changes only when the user verifies something) →
  per-task content. The cache breakpoint sits after the profile snapshot. No
  timestamps or IDs appear before it. `usage.cache_read_input_tokens` is logged
  to spot silent invalidation.
- **Server tools:** `web_search_20260209` / `web_fetch_20260209`. For the
  Immigration agent, `allowed_domains` is limited to `uscis.gov`, `dol.gov`,
  `flag.dol.gov`, `travel.state.gov`, `state.gov`, `ecfr.gov`,
  `federalregister.gov`, `dhs.gov`.
- **Errors:** typed SDK errors (`RateLimitError`, `APIError`, ...). Retryable
  errors back off; non-retryable errors fail the task with the reason recorded.

### 5.4 Grounding: never invent facts

1. CV parsing creates facts as `unverified`. Only the user can verify them (DB trigger).
2. Agents writing to employers receive **only verified facts** with `public` or
   `summary_only` disclosure. `private` facts never enter a prompt.
3. Every outreach draft returns `cited_facts[]`, stored in `message_fact_citations`.
   A post-generation **claim checker** (a second structured call plus
   deterministic rules) flags any sentence about the user that maps to no cited
   fact. Flagged drafts cannot be submitted for approval.
4. The database refuses approval or sending while any cited fact is unverified.
5. Work authorisation is injected as a fixed, user-approved sentence
   (for example "I am an Australian citizen and would require employer
   sponsorship, such as E-3 or H-1B, to work in the US"). The checker rejects
   drafts that claim or imply current US work authorisation.

### 5.5 Prompt-injection posture

- Inbound mail and web content are placed in clearly delimited data blocks, and
  the system prompt tells the model they are untrusted.
- An agent reading untrusted content has no tool that can act externally (no
  such tool exists, §5.1). The worst case is a bad draft, which a human reviews.
- HTML is stripped to text before storage. Links in inbound mail are not fetched
  automatically.
- Classification output is schema-constrained. Low-confidence results are routed
  to the user.

## 6. Immigration intelligence

Pathways tracked (`visa_pathway` enum): **E-3** (Australia-specific; see
ADR-008), **H-1B**, **L-1A/L-1B**, **EB-2**, **EB-2 NIW**, **EB-3**.

**Evidence model.** Every claim about an employer's sponsorship is an
`sponsorship_evidence` row with a source, a retrieval time and an evidence type.
`strength` is a **generated column**, so nothing can label historical data as
anything else:

| Strength | Evidence types | How the UI may describe it |
|---|---|---|
| `historical` | DOL LCA/PERM disclosure data, USCIS H-1B Employer Data Hub | "Filed N LCAs for SOC 19-5011 in FY2025" — **not** "will sponsor" |
| `public_statement` | Job posting offers or declines sponsorship; careers policy | Quote with link and date |
| `direct_confirmation` | Written confirmation to this user (must link to a stored email) | "Confirmed in writing on <date>" |

`v_employer_sponsorship.sponsorship_signal` returns `confirmed_in_writing`,
`publicly_declines`, `publicly_states_sponsorship`, `historical_sponsor_only` or
`no_evidence`, in that order of precedence.

**Data sources (authoritative):** DOL OFLC disclosure files (LCA, PERM) and the
FLAG system; USCIS H-1B Employer Data Hub; DOS Visa Bulletin (EB-2/EB-3 dates
for "All Chargeability", which covers Australia); eCFR (8 CFR 214.2, 8 CFR 204.5;
20 CFR 655/656); Federal Register for rule changes. Disclosure files are imported
by an ops job, filtered to HSEQ-relevant SOC codes (configurable, starting with
19-5011, 19-5012, 17-2111, 13-1041, 11-3051, 17-2081, 19-2041).

**Policy freshness.** Fees, caps, lottery rules and proclamations change. No rule
is hard-coded. Assessments must cite `ref_authoritative_sources` rows (checked by
the DB), and a scheduled task re-checks sources older than 30 days and flags
assessments whose sources changed.

**Representations.** Any outbound message making immigration statements uses the
category `immigration_representation`. Approving it requires explicit
acknowledgement (`binding_acknowledged`).

## 7. Email integration

| Phase | Gmail scopes | Microsoft Graph scopes | Enabled at |
|---|---|---|---|
| Read | `gmail.readonly` | `Mail.Read`, `offline_access`, `User.Read` | Milestone 7 |
| Send | add `gmail.send` | add `Mail.Send` | Milestone 8 gate, after user sign-off |

- Refresh tokens are encrypted with AES-256-GCM in the app (`token_key_id` allows
  key rotation). Users see account metadata only. Agents cannot read the table.
- Sync uses Gmail `users.history.list` with a stored `historyId` (Pub/Sub `watch`
  later) and Graph delta queries (change notifications later). Only threads
  matching tracked contacts or employer domains, or labelled by the user, are
  stored, which limits personal-mail exposure.
- Sending: the dispatcher claims `approved`/`scheduled` messages and sets
  `sending`. The DB **send gate** runs inside that update. If it passes, the
  dispatcher sends via the provider, then records `sent` or `failed`. Messages
  are sent as replies in the existing thread where one exists.
- Every outbound message includes the user's real name, contact details and a
  one-line opt-out ("Reply 'no thanks' and I won't contact you again"). Opt-out
  and bounce replies are added to the suppression list automatically by a
  trigger.
- Google OAuth: in a single-user deployment the app stays in "testing" mode with
  the user as a test user. Publishing to other users would need Google
  restricted-scope verification.

## 8. Safeguards

See [`SAFEGUARDS.md`](SAFEGUARDS.md) for the full matrix: each mandatory
safeguard, where it is enforced, and the test that proves it.

Anti-spam defaults (the user can lower them but cannot exceed the ceilings):

| Limit | Default | Hard ceiling |
|---|---|---|
| Initial outreach per day | 5 | 15 |
| All sends per day | 20 | 40 |
| Sends per recipient domain per week | 3 | 5 |
| Cool-down before cold-contacting the same employer again | 30 days | ≥ 14 |
| Follow-ups without a reply | 2 | 3 |
| Gap between follow-ups | 5 days | ≥ 3 |
| Recipients per message | to ≤ 3, cc ≤ 3 | — |

Also enforced: one cold email per recipient (anything later must be a follow-up
in the thread), suppression by address or domain, do-not-contact flags, and no
guessed addresses.

## 9. Privacy and confidentiality

- **Data minimisation for prompts:** a single `buildAgentContext()` function is
  the only path from the DB to a prompt. It drops `private` facts and reduces
  `summary_only` ones to their general description. It is unit-tested.
- **Current-employer confidentiality:** an employer name can be `summary_only`
  (for example "a top-20 ASX-listed contractor"). Achievements default to
  `summary_only`. Agents are told not to disclose project names, clients or
  figures unless they are marked `public`.
- **Third-party data:** only business contact details published for recruiting
  purposes, with source URL recorded. Contacts can be deleted on request.
- **Audit log** stores row diffs but **hashes** email bodies, job descriptions
  and token ciphertext.
- **Jurisdictions:** the user is in Australia (Privacy Act 1988, APPs; Spam Act
  2003 for any message that could be called commercial) and the recipients are in
  the US (CAN-SPAM). Data stays in the Sydney region. Claude API and US mail
  providers are cross-border disclosures, documented in the privacy notice.
- **Retention:** inbound mail bodies older than 18 months are purged, keeping
  metadata and classification. Deleting the account cascades everywhere except
  the audit log, which keeps hashes only.

## 10. Observability

- `agent_runs`: model, effort, tokens, cache hits, cost, stop reason, errors.
- `audit_log`: every insert, update and delete on decision-bearing tables, with
  actor type (user, agent, dispatcher, operator) and agent name. It is
  append-only (trigger plus revoked grants) and hash-chained per user;
  `fn_verify_audit_chain()` detects tampering.
- The dashboard's Agent Activity page shows the run timeline, cost per day,
  blocked sends with the reason, and the kill-switch state.

## 11. Repository layout (target)

```
hseq-career-agent/
  app/                      Next.js routes
    (auth)/                 sign-in, MFA
    dashboard/              overview
    employers/  jobs/  email/  applications/  immigration/  activity/  profile/
    api/cron/               worker + dispatcher triggers (signed)
  lib/
    db/                     typed Supabase clients per role
    agents/                 runtime, definitions, tools, prompts, schemas
    agents/context.ts       buildAgentContext() — only DB→prompt path
    mail/                   gmail.ts, graph.ts, dispatcher.ts, sync.ts
    safety/                 claim checker, rate-limit preview, content hash
    immigration/            source registry, DOL import
  supabase/
    migrations/             SQL migrations
    tests/                  SQL safeguard tests (run.sh)
  tests/                    vitest unit + playwright e2e
  docs/
```
