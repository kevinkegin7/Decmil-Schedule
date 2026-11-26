# Database — Milestone 1

Migration: `supabase/migrations/20261126000100_milestone1_foundation.sql`.
Generated types: `src/types/database.types.ts` (`npm run db:types`).

## Tables

All user tables have Row Level Security, `created_at` and `updated_at`
(maintained by a trigger), and are audited.

### `profiles` — identity and headline (1:1 with `auth.users`, key `id`)
`full_name`, `email` (contact email; can differ from the login), `current_location`,
`current_employer`, `current_job_title`, `professional_summary` (**headline**, ≤ 600),
`linkedin_url` (must be an `https://…linkedin.com/` URL).

### `career_profiles` — detailed profile (1:1, unique `user_id`)
`total_experience_years`, `australian_experience_years`, `international_experience_years`
(0–60; Australian + international ≤ total), `primary_industries[]`, `target_job_titles[]`,
`core_competencies[]`, `professional_summary` (**detailed narrative**, ≤ 4,000),
`education_summary`, `profile_status` (`draft` | `in_review` | `complete`).

> The brief puts `professional_summary` on both tables. The UI treats the
> `profiles` one as a short headline and the `career_profiles` one as the full
> narrative.

### `employment_history`
`employer_name`, `job_title`, `industry`, `project_name`, `country`, `location`,
`start_date`, `end_date`, `is_current`, `responsibilities`, `achievements`, plus
**`needs_review`** (true for imported records).
Rules: end ≥ start; a current role has no end date. `start_date` is nullable
**only** so imported records with unknown dates can be stored; the form
requires it, and a profile cannot be marked complete while any start date is missing.

### `qualifications`
`qualification_name`, `awarding_organisation`, `qualification_type`, `country`,
`issue_date`, `expiry_date` (must be after the issue date), `verification_status`
(`unverified` | `user_verified` | `document_verified`), `verified_at`,
`evidence_file_path`, `needs_review`.

### `career_preferences` (1:1, unique `user_id`)
Defaults are the owner's initial settings:

| Field | Default |
|---|---|
| `target_salary_min` / `max` | 120,000 / 150,000 (min ≤ max enforced) |
| `salary_currency` / `salary_period` | `USD` / `annual` (only values allowed) |
| `salary_basis_note` | Annual base salary, excluding bonus and benefits |
| `preferred_states` | all 50 states (`DC` selectable; codes checked against `us_state_codes()`) |
| `preferred_industries` | mining, construction, energy, renewable_energy, oil_and_gas, infrastructure, manufacturing |
| `preferred_job_titles` | Senior HSEQ Advisor, HSEQ Manager, EHS Manager, Safety Manager, Construction Safety Manager, Mining Safety Manager |
| `relocation_willingness`, `rotational_work_preference`, `residential_work_preference`, `employer_sponsorship_required` | true |
| `preferred_email_provider` | `outlook` |
| `email_autonomy` | `approval_then_limited_followups` |

### `user_controls` (1:1)
`agents_paused`, `outbound_paused`, `pause_reason`, `paused_at`, and
`external_comms_enabled`, which a CHECK constraint (`external_comms_locked_in_m1`)
holds at `false`. A future migration removes the lock only after you approve
enabling email.

### `audit_logs` — append-only
`id` (uuid), `seq` (ordering), `user_id`, `action`, `entity_type`, `entity_id`,
`details` (jsonb), `created_at`, `prev_hash`, `hash`.

- Row changes on all user tables are written by a `SECURITY DEFINER` trigger.
  Actions look like `employment_history.update`; `details` holds
  `changed_fields`, `before` and `after`.
- Application events (`app.auth.signed_in`, `app.auth.signed_out`,
  `app.evidence.uploaded`, …) are written through `log_audit_event()`, which only
  accepts `app.*` actions for the caller's own user id.
- Long free text (summaries, responsibilities, achievements, education) is
  stored as `{sha256, length}`, not copied.
- Users have SELECT only. INSERT/UPDATE/DELETE are not granted, and a trigger
  also blocks UPDATE, DELETE and TRUNCATE.
- Each entry's `hash` covers the previous entry's hash. `verify_audit_chain()`
  returns the first broken `seq` (Settings → Verify integrity).

## Functions

| Function | Purpose |
|---|---|
| `load_starter_profile()` | Loads the owner's known facts for the caller (security invoker, so RLS applies). Idempotent; fills only empty fields; adds records only if none exist; all flagged `needs_review`, all qualifications unverified, no dates. |
| `log_audit_event(action, entity_type, entity_id, details)` | App events into the audit log (`app.<area>.<event>` only, ≤ 4 KB). |
| `verify_audit_chain()` | Integrity check of the caller's audit chain. |
| `us_state_codes()`, `industry_codes()` | Reference lists used by CHECK constraints (the app copy is tested for parity). |

## Guard triggers

| Trigger | Rule |
|---|---|
| `fn_qualification_verification` | Inserts are always `unverified`. Editing a verified record resets it to `unverified`. Verifying requires `needs_review = false`. Stamps `verified_at`. |
| `fn_career_profile_completion` | `profile_status = 'complete'` is refused while any record needs review, any employment start date is missing, or name/email is empty. |
| `fn_user_controls_pause` | Maintains `paused_at`. |

## Storage

Bucket `qualification-evidence`: **private**, 10 MB limit, PDF/PNG/JPEG only.
Object names are `<user id>/<qualification id>/<timestamp>-<file>`. Policies
allow select, insert, update and delete only when the first folder equals
`auth.uid()`. Files are viewed through 60-second signed URLs. The
`evidence_file_path` column has a CHECK that it starts with the owner's id.

## Seed

`supabase/seed.sql` runs only on the local stack (`supabase start` / `db reset`).
It creates `owner@hseq.local` and calls `load_starter_profile()` as that user.
`supabase db push` does not run it.

## Changing the schema

Add a new timestamped file in `supabase/migrations/`, then run `npm run db:reset`
locally, `npm run db:types`, and the test suites. Production changes go through
`supabase db push` only.

---

# Milestone 2 tables

Migration: `supabase/migrations/20261126000200_milestone2_employer_job_intelligence.sql`.
Every user table has RLS (select/insert/update/delete on `user_id = auth.uid()`)
and the audit trigger. A `fn_assert_same_owner` trigger also stops anyone
attaching jobs, evidence, saves or rankings to an employer or job they don't own.

| Table | Purpose | Key rules |
|---|---|---|
| `data_sources` (shared, read-only) | Registry of permitted sources and how each may be used | Seeded by migration; users have SELECT only |
| `ref_authoritative_sources` (shared, read-only) | Official USCIS / DOL / DOS pages cited by assessments | `last_verified_at` is NULL until `verify:sources` gets HTTP 200 |
| `employers` | Employer profile, official careers URL, ATS board, FEIN | Names normalised by trigger (unique per user); state codes checked; `is_sample` |
| `job_opportunities` | Discovered postings | `source` + `source_url` + `retrieved_at` required; salary source and confidence; min ≤ max; unique per (user, source, external id); `status` open/closed |
| `sponsorship_evidence` | Every sponsorship claim with source, dates, confidence | `category` is GENERATED from `evidence_type`; URL required except written confirmation; written confirmation must be user-verified; history needs a fiscal year |
| `saved_employers`, `saved_jobs` | Your shortlists | Unique per user and item |
| `immigration_profiles` | Citizenship(s), country of birth, Australian status, degree, post-degree years, employer US affiliate | AU citizenship and "citizen" status must agree |
| `pathway_assessments` | Latest result per pathway | Must cite at least one source code; algorithm version and inputs hash |
| `job_matches` | Latest ranking per job, with components and flags | Score 0–100; band; algorithm version; inputs hash; `run_id` |
| `agent_runs` | Each research / ranking / assessment run | Status, trigger (user/script), input and output summaries, error |

`fn_audit_redact` now also hashes `description_text`, `description`, `excerpt`
and `notes` in the audit log.

`load_starter_immigration_profile()` records the owner's stated citizenship
(non-Australian), bachelor's degree and field. It does **not** assume country of
birth, Australian residence status or experience years.
