-- =============================================================================
-- HSEQ USA Career Agent — initial schema (Milestone 0)
--
-- Design rule: every mandatory safeguard is enforced in the database as well
-- as in application code. App code can have bugs; these triggers fail closed.
--
-- Request roles (taken from the verified Supabase JWT via auth.role()):
--   authenticated     the human user, through the dashboard
--   agent_worker      the six LLM agents (can read and draft, never send/approve)
--   dispatcher        deterministic mail sender (can send only approved mail)
--   service_role      operator / migrations (platform kill switch, reference data)
-- A connection with no JWT claims gets a NULL role and is refused by every
-- privileged transition (fail closed).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Roles for least-privilege service access
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agent_worker') then
    create role agent_worker nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'dispatcher') then
    create role dispatcher nologin;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant agent_worker to authenticator;
    grant dispatcher to authenticator;
  end if;
end $$;

grant usage on schema public to agent_worker, dispatcher;
grant usage on schema extensions to agent_worker, dispatcher;
-- RLS policies and guards call auth.uid() / auth.role() as the request role.
grant usage on schema auth to agent_worker, dispatcher;
grant execute on function auth.uid(), auth.role() to agent_worker, dispatcher;

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------
create type public.agent_name as enum (
  'career_director', 'employer_intelligence', 'immigration_intelligence',
  'employer_outreach', 'email_negotiator', 'application_manager');

create type public.actor_type as enum ('user', 'agent', 'dispatcher', 'operator', 'system');

create type public.work_authorization_status as enum (
  'requires_sponsorship',            -- default: Australian citizen, no US status
  'authorized_employer_specific',    -- holds a current employer-specific visa
  'authorized_unrestricted');        -- green card / EAD; needs document evidence

create type public.verification_status as enum (
  'unverified', 'user_verified', 'document_verified', 'rejected');

create type public.qualification_type as enum (
  'degree', 'diploma', 'certificate', 'licence', 'registration', 'training', 'membership');

create type public.disclosure_level as enum (
  'public',        -- agents may quote it in outreach
  'summary_only',  -- agents may describe it in general terms, no names/figures
  'private');      -- never leaves the database into an LLM prompt

create type public.industry as enum (
  'mining', 'construction', 'energy', 'manufacturing', 'infrastructure', 'other');

create type public.employer_status as enum ('prospect', 'target', 'monitoring', 'excluded');

create type public.job_source as enum (
  'ats_greenhouse', 'ats_lever', 'ats_ashby', 'ats_workday', 'company_site',
  'job_board', 'recruiter', 'user_entered');

create type public.sponsorship_statement as enum (
  'offers_sponsorship', 'no_sponsorship', 'unclear', 'not_stated');

create type public.job_status as enum (
  'new', 'shortlisted', 'dismissed', 'applying', 'applied', 'closed');

-- No 'guessed' / 'pattern_inferred' value on purpose: the platform never
-- emails an address it constructed from a name pattern.
create type public.contact_email_source as enum (
  'job_posting', 'company_website', 'user_provided', 'inbound_correspondence',
  'professional_directory');

create type public.suppression_reason as enum (
  'unsubscribe', 'bounce', 'complaint', 'user_blocked', 'employer_request');

create type public.visa_pathway as enum (
  'e3', 'h1b', 'l1a', 'l1b', 'eb2', 'eb2_niw', 'eb3', 'other');

create type public.pathway_assessment as enum (
  'likely', 'possible', 'unlikely', 'not_applicable', 'needs_attorney_review');

create type public.evidence_type as enum (
  'lca_disclosure',         -- DOL OFLC LCA disclosure data (historical)
  'perm_disclosure',        -- DOL OFLC PERM disclosure data (historical)
  'uscis_h1b_hub',          -- USCIS H-1B Employer Data Hub (historical)
  'job_posting_offers',     -- current posting says sponsorship available
  'job_posting_declines',   -- current posting says no sponsorship
  'employer_public_policy', -- careers page / policy statement
  'written_confirmation');  -- employer confirmed in writing to this user

create type public.evidence_strength as enum (
  'historical', 'public_statement', 'direct_confirmation');

create type public.mail_provider as enum ('gmail', 'microsoft');
create type public.connection_status as enum ('active', 'revoked', 'error');
create type public.message_direction as enum ('inbound', 'outbound');

create type public.inbound_classification as enum (
  'positive_interest', 'interview_request', 'information_request',
  'sponsorship_question', 'offer', 'rejection', 'auto_reply',
  'unsubscribe_request', 'bounce', 'spam', 'other', 'unclassified');

create type public.outbound_category as enum (
  'initial_outreach', 'follow_up', 'reply', 'scheduling',
  'offer_negotiation', 'offer_response', 'immigration_representation', 'withdrawal');

create type public.outbound_status as enum (
  'draft', 'pending_approval', 'approved', 'scheduled', 'sending',
  'sent', 'failed', 'rejected', 'cancelled');

create type public.approval_subject as enum ('outbound_message');
create type public.approval_decision as enum ('approved', 'rejected');

create type public.application_status as enum (
  'preparing', 'submitted', 'screening', 'interviewing', 'offer',
  'accepted', 'declined', 'rejected', 'withdrawn');

create type public.offer_status as enum (
  'received', 'under_review', 'countered', 'accepted', 'declined', 'expired', 'rescinded');

create type public.sponsorship_offer as enum ('none', 'verbal', 'in_writing', 'unknown');

create type public.task_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create type public.action_status as enum ('open', 'done', 'dismissed');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Role of the current request as asserted by the verified JWT.
create or replace function public.fn_request_role()
returns text language sql stable set search_path = '' as $$
  select nullif(auth.role(), '')
$$;

create or replace function public.fn_actor_type()
returns public.actor_type language sql stable set search_path = '' as $$
  select case public.fn_request_role()
    when 'authenticated' then 'user'::public.actor_type
    when 'agent_worker'  then 'agent'::public.actor_type
    when 'dispatcher'    then 'dispatcher'::public.actor_type
    when 'service_role'  then 'operator'::public.actor_type
    else 'system'::public.actor_type end
$$;

create or replace function public.fn_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.fn_email_domain(addr text)
returns text language sql immutable set search_path = '' as $$
  select lower(split_part(trim(addr), '@', 2))
$$;

-- -----------------------------------------------------------------------------
-- Kill switches and per-user controls
-- -----------------------------------------------------------------------------
create table public.platform_controls (
  id                         smallint primary key default 1 check (id = 1),
  agents_paused              boolean not null default false,
  outbound_paused            boolean not null default false,
  -- Operator gate: stays false until the user signs off Milestone 8.
  external_comms_enabled     boolean not null default false,
  reason                     text,
  updated_at                 timestamptz not null default now()
);
insert into public.platform_controls (id) values (1);

create table public.user_controls (
  user_id                    uuid primary key references auth.users (id) on delete cascade,
  agents_paused              boolean not null default false,
  outbound_paused            boolean not null default false,
  paused_at                  timestamptz,
  pause_reason               text,
  external_comms_enabled     boolean not null default false,
  external_comms_enabled_at  timestamptz,
  -- Anti-spam limits. CHECKs are hard ceilings the user cannot raise.
  max_initial_outreach_per_day   int not null default 5  check (max_initial_outreach_per_day between 0 and 15),
  max_total_sends_per_day        int not null default 20 check (max_total_sends_per_day between 0 and 40),
  max_sends_per_domain_per_week  int not null default 3  check (max_sends_per_domain_per_week between 0 and 5),
  employer_outreach_cooldown_days int not null default 30 check (employer_outreach_cooldown_days >= 14),
  max_follow_ups                 int not null default 2  check (max_follow_ups between 0 and 3),
  min_follow_up_gap_days         int not null default 5  check (min_follow_up_gap_days >= 3),
  updated_at                 timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Career profile (Career Director)
-- -----------------------------------------------------------------------------
create table public.profiles (
  user_id                    uuid primary key references auth.users (id) on delete cascade,
  full_name                  text not null,
  headline                   text,
  location_city              text,
  location_country           text not null default 'AU',
  timezone                   text not null default 'Australia/Perth',
  citizenships               text[] not null default array['AU'],
  us_work_authorization      public.work_authorization_status not null default 'requires_sponsorship',
  work_authorization_evidence_path text,   -- storage path of the visa/EAD/green card
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint work_auth_needs_evidence check (
    us_work_authorization = 'requires_sponsorship' or work_authorization_evidence_path is not null)
);

create table public.cv_documents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  storage_path   text not null,
  file_name      text not null,
  version        int not null,
  is_current     boolean not null default false,
  sha256         text not null,
  uploaded_at    timestamptz not null default now(),
  unique (user_id, version)
);
create unique index cv_one_current on public.cv_documents (user_id) where is_current;

create table public.employment_history (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  employer_name        text not null,
  employer_disclosure  public.disclosure_level not null default 'public',
  role_title           text not null,
  location             text,
  industry             public.industry,
  start_date           date not null,
  end_date             date,
  is_current           boolean not null default false,
  summary              text,
  verification_status  public.verification_status not null default 'unverified',
  verified_at          timestamptz,
  source_cv_id         uuid references public.cv_documents (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table public.employment_achievements (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  employment_id        uuid not null references public.employment_history (id) on delete cascade,
  statement            text not null,
  metric               text,
  disclosure           public.disclosure_level not null default 'summary_only',
  verification_status  public.verification_status not null default 'unverified',
  verified_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.qualifications (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  qualification_type   public.qualification_type not null,
  title                text not null,
  issuer               text not null,
  country              text,
  awarded_on           date,
  expires_on           date,
  credential_id        text,
  us_equivalency_note  text,      -- e.g. outcome of a foreign credential evaluation
  evidence_path        text,      -- storage path of certificate scan
  verification_status  public.verification_status not null default 'unverified',
  verified_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint document_verified_needs_evidence check (
    verification_status <> 'document_verified' or evidence_path is not null)
);

create table public.skills (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  name                 text not null,
  category             text,
  years_experience     numeric(4,1),
  verification_status  public.verification_status not null default 'unverified',
  verified_at          timestamptz,
  unique (user_id, name)
);

create table public.career_preferences (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  target_titles         text[] not null default '{}',
  target_industries     public.industry[] not null default '{}',
  target_states         text[] not null default '{}',
  excluded_employers    text[] not null default '{}',
  min_base_salary_usd   int,
  target_base_salary_usd int,
  open_to_relocation    boolean not null default true,
  open_to_fifo          boolean not null default true,
  earliest_start_date   date,
  notes                 text,
  updated_at            timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Employers, jobs and contacts (Employer Intelligence, Employer Outreach)
-- -----------------------------------------------------------------------------
create table public.employers (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  normalized_name   text not null,
  website           text,
  email_domain      text,
  industries        public.industry[] not null default '{}',
  hq_state          text,
  us_states         text[] not null default '{}',
  size_band         text,
  fein              text,          -- used to match DOL disclosure rows
  status            public.employer_status not null default 'prospect',
  fit_score         numeric(5,2) check (fit_score between 0 and 100),
  fit_rationale     text,
  notes             text,
  discovered_by     public.actor_type not null default 'user',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create table public.job_opportunities (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  employer_id           uuid references public.employers (id) on delete set null,
  title                 text not null,
  location              text,
  us_state              text,
  source                public.job_source not null,
  source_url            text not null,
  external_id           text not null,
  posted_at             date,
  closes_at             date,
  salary_min_usd        int,
  salary_max_usd        int,
  sponsorship_statement public.sponsorship_statement not null default 'not_stated',
  sponsorship_excerpt   text,         -- verbatim text from the posting
  description           text,
  soc_code              text,
  fit_score             numeric(5,2) check (fit_score between 0 and 100),
  fit_rationale         text,
  status                public.job_status not null default 'new',
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create table public.contacts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  employer_id        uuid references public.employers (id) on delete set null,
  full_name          text,
  role_title         text,
  email              text not null,
  email_source       public.contact_email_source not null,
  source_url         text,           -- where the address was published
  do_not_contact     boolean not null default false,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, email),
  constraint published_source_needs_url check (
    email_source in ('user_provided', 'inbound_correspondence') or source_url is not null)
);

create table public.suppression_list (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  email       text,
  domain      text,
  reason      public.suppression_reason not null,
  created_at  timestamptz not null default now(),
  check ((email is not null) <> (domain is not null))
);
create unique index suppression_email_uq on public.suppression_list (user_id, lower(email)) where email is not null;
create unique index suppression_domain_uq on public.suppression_list (user_id, lower(domain)) where domain is not null;

-- -----------------------------------------------------------------------------
-- Immigration intelligence
-- -----------------------------------------------------------------------------

-- Shared reference: authoritative government pages the agent relied on.
create table public.ref_authoritative_sources (
  id            uuid primary key default gen_random_uuid(),
  url           text not null unique,
  authority     text not null check (authority in ('USCIS','DOL','DOS','DHS','eCFR','FederalRegister','other_gov')),
  title         text not null,
  retrieved_at  timestamptz not null,
  content_sha256 text not null,
  excerpt       text
);

-- Shared reference: filtered DOL OFLC disclosure rows for HSEQ-relevant SOC codes.
create table public.ref_dol_disclosures (
  id               bigserial primary key,
  program          text not null check (program in ('LCA','PERM')),
  case_number      text not null,
  case_status      text not null,
  fiscal_year      int not null,
  employer_name    text not null,
  employer_fein    text,
  employer_state   text,
  job_title        text,
  soc_code         text,
  visa_class       text,            -- H-1B, E-3 Australian, H-1B1, ...
  wage_offered_from numeric,
  wage_unit        text,
  worksite_state   text,
  decision_date    date,
  source_file      text not null,   -- OFLC file name, for traceability
  unique (program, case_number)
);
create index ref_dol_employer_idx on public.ref_dol_disclosures (lower(employer_name));
create index ref_dol_fein_idx on public.ref_dol_disclosures (employer_fein);

create table public.sponsorship_evidence (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  employer_id      uuid not null references public.employers (id) on delete cascade,
  evidence_type    public.evidence_type not null,
  strength         public.evidence_strength generated always as (
                     case
                       when evidence_type in ('lca_disclosure','perm_disclosure','uscis_h1b_hub') then 'historical'::public.evidence_strength
                       when evidence_type = 'written_confirmation' then 'direct_confirmation'::public.evidence_strength
                       else 'public_statement'::public.evidence_strength
                     end) stored,
  visa_class       text,
  fiscal_year      int,
  filing_count     int,
  soc_codes        text[] not null default '{}',
  source_url       text,
  source_name      text not null,
  retrieved_at     timestamptz not null,
  excerpt          text,
  disclosure_id    bigint references public.ref_dol_disclosures (id),
  email_message_id uuid,              -- FK added after email_messages exists
  created_by       public.actor_type not null,
  created_at       timestamptz not null default now(),
  constraint written_confirmation_needs_email check (
    evidence_type <> 'written_confirmation' or email_message_id is not null),
  constraint non_written_needs_url check (
    evidence_type = 'written_confirmation' or source_url is not null)
);

create table public.immigration_pathway_assessments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  pathway            public.visa_pathway not null,
  employer_id        uuid references public.employers (id) on delete cascade,
  assessment         public.pathway_assessment not null,
  rationale          text not null,
  requirements       jsonb not null default '[]',   -- [{requirement, met: yes|no|unknown, note}]
  open_questions     text[] not null default '{}',
  source_ids         uuid[] not null,                -- ref_authoritative_sources ids
  assessed_by        public.actor_type not null,
  assessed_at        timestamptz not null default now(),
  user_reviewed_at   timestamptz,
  attorney_reviewed_at timestamptz,
  attorney_name      text,
  constraint cites_sources check (cardinality(source_ids) > 0)
);

create table public.immigration_milestones (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  pathway         public.visa_pathway not null,
  employer_id     uuid references public.employers (id) on delete set null,
  title           text not null,                -- e.g. "LCA certified", "Priority date"
  due_on          date,
  completed_on    date,
  reference       text,                         -- receipt / case number (user-entered)
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Applications, interviews, offers (Application Manager)
-- -----------------------------------------------------------------------------
create table public.applications (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  job_opportunity_id     uuid references public.job_opportunities (id) on delete set null,
  employer_id            uuid not null references public.employers (id) on delete restrict,
  status                 public.application_status not null default 'preparing',
  submitted_at           timestamptz,
  submission_method      text,
  salary_expectation_usd int,
  sponsorship_discussed  boolean not null default false,
  next_action            text,
  next_action_due        date,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.interviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  application_id  uuid not null references public.applications (id) on delete cascade,
  scheduled_at    timestamptz not null,
  timezone        text not null,
  format          text,
  interviewers    text[] not null default '{}',
  prep_notes      text,
  outcome         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.offers (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  application_id         uuid not null references public.applications (id) on delete cascade,
  base_salary            numeric(12,2),
  currency               text not null default 'USD',
  bonus_description      text,
  benefits               jsonb not null default '{}',
  sponsorship            public.sponsorship_offer not null default 'unknown',
  sponsorship_pathway    public.visa_pathway,
  relocation_support     text,
  start_date             date,
  expires_at             timestamptz,
  status                 public.offer_status not null default 'received',
  decided_at             timestamptz,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.action_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null,
  detail        text,
  due_on        date,
  status        public.action_status not null default 'open',
  entity_type   text,
  entity_id     uuid,
  created_by    public.actor_type not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Email (Email Negotiator, Dispatcher)
-- -----------------------------------------------------------------------------
create table public.mail_accounts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  provider                 public.mail_provider not null,
  email_address            text not null,
  scopes                   text[] not null,
  encrypted_refresh_token  bytea not null,   -- AES-256-GCM, key held outside the DB
  token_key_id             text not null,
  status                   public.connection_status not null default 'active',
  sync_cursor              text,             -- Gmail historyId / Graph deltaLink
  connected_at             timestamptz not null default now(),
  revoked_at               timestamptz,
  unique (user_id, provider, email_address)
);

create table public.email_threads (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  mail_account_id     uuid not null references public.mail_accounts (id) on delete cascade,
  provider_thread_id  text not null,
  subject             text,
  employer_id         uuid references public.employers (id) on delete set null,
  contact_id          uuid references public.contacts (id) on delete set null,
  application_id      uuid references public.applications (id) on delete set null,
  last_message_at     timestamptz,
  needs_attention     boolean not null default false,
  unique (mail_account_id, provider_thread_id)
);

create table public.email_messages (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  thread_id             uuid not null references public.email_threads (id) on delete cascade,
  direction             public.message_direction not null,
  provider_message_id   text not null,
  from_address          text not null,
  to_addresses          text[] not null,
  cc_addresses          text[] not null default '{}',
  subject               text,
  body_text             text,          -- sanitised plain text, HTML stripped
  received_at           timestamptz not null,
  classification        public.inbound_classification not null default 'unclassified',
  classification_confidence numeric(4,3),
  classification_rationale  text,
  created_at            timestamptz not null default now(),
  unique (thread_id, provider_message_id)
);

alter table public.sponsorship_evidence
  add constraint sponsorship_evidence_email_fk
  foreign key (email_message_id) references public.email_messages (id) on delete restrict;

create table public.outbound_messages (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  mail_account_id      uuid not null references public.mail_accounts (id) on delete restrict,
  thread_id            uuid references public.email_threads (id) on delete set null,
  in_reply_to_message_id uuid references public.email_messages (id) on delete set null,
  employer_id          uuid references public.employers (id) on delete set null,
  contact_id           uuid references public.contacts (id) on delete set null,
  application_id       uuid references public.applications (id) on delete set null,
  category             public.outbound_category not null,
  to_addresses         text[] not null check (cardinality(to_addresses) between 1 and 3),
  cc_addresses         text[] not null default '{}' check (cardinality(cc_addresses) <= 3),
  subject              text not null,
  body_text            text not null,
  content_hash         text not null default '',
  status               public.outbound_status not null default 'draft',
  drafted_by           public.actor_type not null,
  agent_run_id         uuid,
  scheduled_for        timestamptz,
  send_started_at      timestamptz,
  sent_at              timestamptz,
  provider_message_id  text,
  failure_reason       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint follow_up_needs_thread check (
    category not in ('follow_up','reply') or thread_id is not null)
);
create index outbound_status_idx on public.outbound_messages (user_id, status);

-- Which verified profile facts a draft relies on. Approval and sending are
-- blocked if any cited fact is not verified by the user.
create table public.message_fact_citations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  outbound_message_id  uuid not null references public.outbound_messages (id) on delete cascade,
  qualification_id     uuid references public.qualifications (id) on delete restrict,
  employment_id        uuid references public.employment_history (id) on delete restrict,
  achievement_id       uuid references public.employment_achievements (id) on delete restrict,
  skill_id             uuid references public.skills (id) on delete restrict,
  check (num_nonnulls(qualification_id, employment_id, achievement_id, skill_id) = 1)
);

create table public.approvals (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  subject_type          public.approval_subject not null,
  subject_id            uuid not null,
  content_hash          text not null,
  decision              public.approval_decision not null,
  binding_acknowledged  boolean not null default false,
  note                  text,
  decided_by            uuid not null references auth.users (id),
  decided_at            timestamptz not null default now()
);
create index approvals_subject_idx on public.approvals (subject_type, subject_id);

-- -----------------------------------------------------------------------------
-- Agent runtime
-- -----------------------------------------------------------------------------
create table public.agent_tasks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  agent         public.agent_name not null,
  task_type     text not null,
  payload       jsonb not null default '{}',
  status        public.task_status not null default 'queued',
  run_after     timestamptz not null default now(),
  attempts      int not null default 0,
  max_attempts  int not null default 3,
  locked_at     timestamptz,
  locked_by     text,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index agent_tasks_ready_idx on public.agent_tasks (status, run_after);

create table public.agent_runs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  task_id             uuid references public.agent_tasks (id) on delete set null,
  agent               public.agent_name not null,
  model               text not null,
  effort              text,
  status              public.task_status not null default 'running',
  summary             text,
  output              jsonb,
  input_tokens        int,
  output_tokens       int,
  cache_read_tokens   int,
  cache_write_tokens  int,
  cost_usd            numeric(10,4),
  stop_reason         text,
  error               text,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz
);

-- -----------------------------------------------------------------------------
-- Audit log: append-only, hash-chained per user
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id            bigserial primary key,
  user_id       uuid,
  occurred_at   timestamptz not null default clock_timestamp(),
  actor_type    public.actor_type not null,
  actor_id      text,
  action        text not null,
  entity_type   text not null,
  entity_id     text,
  before_data   jsonb,
  after_data    jsonb,
  prev_hash     text not null,
  hash          text not null
);
create index audit_user_idx on public.audit_log (user_id, id);

create or replace function public.fn_audit_append(
  p_user_id uuid, p_action text, p_entity_type text, p_entity_id text,
  p_before jsonb, p_after jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_prev text;
  v_hash text;
  v_actor public.actor_type := public.fn_actor_type();
  v_actor_id text := coalesce(auth.uid()::text,
                              nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'agent');
  v_ts timestamptz := clock_timestamp();
begin
  -- Serialise appends per user so the chain is linear.
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_user_id::text, 'platform'), 0));
  select hash into v_prev from public.audit_log
   where user_id is not distinct from p_user_id order by id desc limit 1;
  v_prev := coalesce(v_prev, 'GENESIS');
  v_hash := encode(extensions.digest(
              v_prev || '|' || coalesce(p_user_id::text,'') || '|' || v_ts::text || '|' ||
              v_actor::text || '|' || coalesce(v_actor_id,'') || '|' || p_action || '|' ||
              p_entity_type || '|' || coalesce(p_entity_id,'') || '|' ||
              coalesce(p_before::text,'') || '|' || coalesce(p_after::text,''), 'sha256'), 'hex');
  insert into public.audit_log (user_id, occurred_at, actor_type, actor_id, action, entity_type,
                                entity_id, before_data, after_data, prev_hash, hash)
  values (p_user_id, v_ts, v_actor, v_actor_id, p_action, p_entity_type, p_entity_id,
          p_before, p_after, v_prev, v_hash);
end $$;

-- Recompute the chain; returns the first broken id, or NULL if intact.
create or replace function public.fn_verify_audit_chain(p_user_id uuid)
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare
  r record;
  v_prev text := 'GENESIS';
  v_expect text;
begin
  if public.fn_request_role() = 'authenticated' and p_user_id is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;
  for r in select * from public.audit_log where user_id is not distinct from p_user_id order by id loop
    v_expect := encode(extensions.digest(
              v_prev || '|' || coalesce(r.user_id::text,'') || '|' || r.occurred_at::text || '|' ||
              r.actor_type::text || '|' || coalesce(r.actor_id,'') || '|' || r.action || '|' ||
              r.entity_type || '|' || coalesce(r.entity_id,'') || '|' ||
              coalesce(r.before_data::text,'') || '|' || coalesce(r.after_data::text,''), 'sha256'), 'hex');
    if r.prev_hash <> v_prev or r.hash <> v_expect then
      return r.id;
    end if;
    v_prev := r.hash;
  end loop;
  return null;
end $$;

create or replace function public.fn_audit_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_log is append-only';
end $$;

create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.fn_audit_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.fn_audit_immutable();

-- Generic row-change auditing. Secrets and long bodies are replaced by hashes.
create or replace function public.fn_audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_after  jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_user   uuid;
  v_id     text;
  k        text;
begin
  foreach k in array array['encrypted_refresh_token','body_text','description'] loop
    if v_before ? k and v_before ->> k is not null then
      v_before := jsonb_set(v_before, array[k], to_jsonb('sha256:' || encode(extensions.digest(v_before ->> k, 'sha256'), 'hex')));
    end if;
    if v_after ? k and v_after ->> k is not null then
      v_after := jsonb_set(v_after, array[k], to_jsonb('sha256:' || encode(extensions.digest(v_after ->> k, 'sha256'), 'hex')));
    end if;
  end loop;
  v_user := coalesce((v_after ->> 'user_id')::uuid, (v_before ->> 'user_id')::uuid);
  v_id   := coalesce(v_after ->> 'id', v_before ->> 'id', v_after ->> 'user_id', v_before ->> 'user_id');
  perform public.fn_audit_append(v_user, lower(tg_op), tg_table_name, v_id, v_before, v_after);
  return coalesce(new, old);
end $$;

-- -----------------------------------------------------------------------------
-- Safeguard triggers
-- -----------------------------------------------------------------------------

-- Only the human user may mark a fact verified, or change verification later.
create or replace function public.fn_guard_verification()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.fn_request_role() is distinct from 'authenticated' then
    if tg_op = 'INSERT' and new.verification_status <> 'unverified' then
      raise exception 'only the user can create verified facts (got %)', new.verification_status;
    end if;
    if tg_op = 'UPDATE' and new.verification_status is distinct from old.verification_status then
      raise exception 'only the user can change verification status';
    end if;
    if tg_op = 'UPDATE' and old.verification_status <> 'unverified' then
      raise exception 'verified facts can only be edited by the user';
    end if;
  else
    if tg_op = 'UPDATE' and new.verification_status = old.verification_status
       and old.verification_status in ('user_verified','document_verified')
       and (to_jsonb(new) - 'updated_at' - 'verified_at') is distinct from (to_jsonb(old) - 'updated_at' - 'verified_at') then
      -- Editing a verified fact sends it back for re-verification.
      new.verification_status := 'unverified';
      new.verified_at := null;
    elsif new.verification_status in ('user_verified','document_verified')
       and (tg_op = 'INSERT' or old.verification_status is distinct from new.verification_status) then
      new.verified_at := now();
    end if;
  end if;
  return new;
end $$;

-- Work authorisation may only be changed by the user.
create or replace function public.fn_guard_work_authorization()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.fn_request_role() is distinct from 'authenticated'
     and (tg_op = 'INSERT' and new.us_work_authorization <> 'requires_sponsorship'
          or tg_op = 'UPDATE' and (new.us_work_authorization is distinct from old.us_work_authorization
                                    or new.work_authorization_evidence_path is distinct from old.work_authorization_evidence_path)) then
    raise exception 'only the user can change US work authorisation';
  end if;
  return new;
end $$;

-- Kill switches and external-comms enablement are user/operator only.
create or replace function public.fn_guard_user_controls()
returns trigger language plpgsql set search_path = '' as $$
declare v_role text := public.fn_request_role();
begin
  if v_role = 'authenticated' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'not allowed';
    end if;
  elsif v_role = 'service_role' then
    -- Operator may pause, but may not switch on a user's outbound email.
    if new.external_comms_enabled and (tg_op = 'INSERT' or not old.external_comms_enabled) then
      raise exception 'only the user can enable external communications';
    end if;
  else
    raise exception 'role % may not change user controls', coalesce(v_role, '<none>');
  end if;
  if new.external_comms_enabled and (tg_op = 'INSERT' or not old.external_comms_enabled) then
    new.external_comms_enabled_at := now();
  end if;
  if (new.agents_paused or new.outbound_paused)
     and (tg_op = 'INSERT' or not (old.agents_paused or old.outbound_paused)) then
    new.paused_at := now();
  end if;
  return new;
end $$;

create or replace function public.fn_guard_platform_controls()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.fn_request_role() is distinct from 'service_role' then
    raise exception 'platform controls are operator-only';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Applications / offers: binding status changes are the user's alone.
create or replace function public.fn_guard_application_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.fn_request_role() is distinct from 'authenticated'
     and new.status in ('submitted','accepted','declined','withdrawn')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'only the user can set application status to %', new.status;
  end if;
  if new.status = 'submitted' and new.submitted_at is null then
    new.submitted_at := now();
  end if;
  return new;
end $$;

create or replace function public.fn_guard_offer_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.fn_request_role() is distinct from 'authenticated'
     and new.status in ('accepted','declined','countered')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'only the user can set offer status to %', new.status;
  end if;
  if new.status in ('accepted','declined') and new.decided_at is null then
    new.decided_at := now();
  end if;
  return new;
end $$;

-- Content hash of what the user approves. Any change invalidates approval.
create or replace function public.fn_outbound_hash(m public.outbound_messages)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(jsonb_build_array(
    m.category, m.mail_account_id, m.thread_id, m.to_addresses, m.cc_addresses,
    m.subject, m.body_text)::text, 'sha256'), 'hex')
$$;

create or replace function public.fn_unverified_citations(p_message_id uuid)
returns int language sql stable set search_path = '' as $$
  select count(*)::int from public.message_fact_citations c
  left join public.qualifications q on q.id = c.qualification_id
  left join public.employment_history e on e.id = c.employment_id
  left join public.employment_achievements a on a.id = c.achievement_id
  left join public.skills s on s.id = c.skill_id
  where c.outbound_message_id = p_message_id
    and coalesce(q.verification_status, e.verification_status, a.verification_status, s.verification_status)
        not in ('user_verified','document_verified')
$$;

-- Everything that must be true before a message leaves the building.
create or replace function public.fn_assert_send_allowed(m public.outbound_messages)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uc public.user_controls;
  pc public.platform_controls;
  v_addr text;
  v_recipients text[] := m.to_addresses || m.cc_addresses;
  v_count int;
  v_last timestamptz;
begin
  select * into pc from public.platform_controls where id = 1;
  select * into uc from public.user_controls where user_id = m.user_id;
  if uc.user_id is null then raise exception 'SEND_BLOCKED: no user controls row'; end if;

  if pc.outbound_paused or uc.outbound_paused then
    raise exception 'SEND_BLOCKED: emergency pause is active';
  end if;
  if not pc.external_comms_enabled then
    raise exception 'SEND_BLOCKED: external communications not enabled for the platform';
  end if;
  if not uc.external_comms_enabled then
    raise exception 'SEND_BLOCKED: user has not enabled external communications';
  end if;

  if not exists (select 1 from public.mail_accounts
                 where id = m.mail_account_id and user_id = m.user_id and status = 'active') then
    raise exception 'SEND_BLOCKED: mail account is not active';
  end if;

  -- Every outbound message needs a matching, current approval.
  if not exists (
      select 1 from public.approvals a
      where a.subject_type = 'outbound_message' and a.subject_id = m.id
        and a.decision = 'approved' and a.content_hash = m.content_hash
        and a.user_id = m.user_id
        and (m.category not in ('offer_negotiation','offer_response','immigration_representation','withdrawal')
             or a.binding_acknowledged)) then
    raise exception 'SEND_BLOCKED: no current user approval for this exact content';
  end if;

  if public.fn_unverified_citations(m.id) > 0 then
    raise exception 'SEND_BLOCKED: message cites unverified profile facts';
  end if;

  foreach v_addr in array v_recipients loop
    if exists (select 1 from public.suppression_list s
               where s.user_id = m.user_id
                 and (lower(s.email) = lower(trim(v_addr)) or lower(s.domain) = public.fn_email_domain(v_addr))) then
      raise exception 'SEND_BLOCKED: recipient % is on the suppression list', v_addr;
    end if;
    if exists (select 1 from public.contacts c
               where c.user_id = m.user_id and lower(c.email) = lower(trim(v_addr)) and c.do_not_contact) then
      raise exception 'SEND_BLOCKED: recipient % is marked do-not-contact', v_addr;
    end if;
  end loop;

  -- Daily totals (messages already sending or sent in the last 24 hours).
  select count(*) into v_count from public.outbound_messages o
   where o.user_id = m.user_id and o.id <> m.id and o.status in ('sending','sent')
     and o.send_started_at > now() - interval '24 hours';
  if v_count >= uc.max_total_sends_per_day then
    raise exception 'SEND_BLOCKED: daily send limit reached (%)', uc.max_total_sends_per_day;
  end if;

  -- Per-domain weekly limit.
  foreach v_addr in array v_recipients loop
    select count(*) into v_count from public.outbound_messages o
     where o.user_id = m.user_id and o.id <> m.id and o.status in ('sending','sent')
       and o.send_started_at > now() - interval '7 days'
       and exists (select 1 from unnest(o.to_addresses || o.cc_addresses) x
                   where public.fn_email_domain(x) = public.fn_email_domain(v_addr));
    if v_count >= uc.max_sends_per_domain_per_week then
      raise exception 'SEND_BLOCKED: weekly limit for domain % reached', public.fn_email_domain(v_addr);
    end if;
  end loop;

  if m.category = 'initial_outreach' then
    if m.contact_id is null or m.employer_id is null then
      raise exception 'SEND_BLOCKED: initial outreach must name a contact and employer';
    end if;
    select count(*) into v_count from public.outbound_messages o
     where o.user_id = m.user_id and o.id <> m.id and o.category = 'initial_outreach'
       and o.status in ('sending','sent') and o.send_started_at > now() - interval '24 hours';
    if v_count >= uc.max_initial_outreach_per_day then
      raise exception 'SEND_BLOCKED: daily initial-outreach limit reached (%)', uc.max_initial_outreach_per_day;
    end if;
    if exists (select 1 from public.outbound_messages o
               where o.user_id = m.user_id and o.id <> m.id and o.employer_id = m.employer_id
                 and o.category = 'initial_outreach' and o.status in ('sending','sent')
                 and o.send_started_at > now() - make_interval(days => uc.employer_outreach_cooldown_days)) then
      raise exception 'SEND_BLOCKED: employer was cold-contacted within % days', uc.employer_outreach_cooldown_days;
    end if;
    if exists (select 1 from public.outbound_messages o
               where o.user_id = m.user_id and o.id <> m.id and o.status in ('sending','sent')
                 and o.to_addresses && m.to_addresses) then
      raise exception 'SEND_BLOCKED: recipient already contacted; use a follow-up in the existing thread';
    end if;
  end if;

  if m.category = 'follow_up' then
    -- Follow-ups since the last inbound reply on this thread.
    select max(received_at) into v_last from public.email_messages
     where thread_id = m.thread_id and direction = 'inbound';
    select count(*) into v_count from public.outbound_messages o
     where o.thread_id = m.thread_id and o.id <> m.id and o.category = 'follow_up'
       and o.status in ('sending','sent') and (v_last is null or o.send_started_at > v_last);
    if v_count >= uc.max_follow_ups then
      raise exception 'SEND_BLOCKED: follow-up limit (%) reached for this thread', uc.max_follow_ups;
    end if;
    select max(o.send_started_at) into v_last from public.outbound_messages o
     where o.thread_id = m.thread_id and o.id <> m.id and o.status in ('sending','sent');
    if v_last is not null and v_last > now() - make_interval(days => uc.min_follow_up_gap_days) then
      raise exception 'SEND_BLOCKED: follow-up sooner than % days after last message', uc.min_follow_up_gap_days;
    end if;
  end if;
end $$;

-- Outbound state machine + who may drive each transition.
create or replace function public.fn_outbound_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_role text := public.fn_request_role();
  v_new_hash text;
begin
  v_new_hash := public.fn_outbound_hash(new);

  if tg_op = 'INSERT' then
    if v_role not in ('authenticated','agent_worker') then
      raise exception 'role % may not create outbound messages', coalesce(v_role,'<none>');
    end if;
    if new.status not in ('draft','pending_approval') then
      raise exception 'new outbound messages must start as draft or pending_approval';
    end if;
    new.content_hash := v_new_hash;
    return new;
  end if;

  -- Content edits.
  if v_new_hash is distinct from old.content_hash then
    if old.status in ('sending','sent') then
      raise exception 'cannot edit a message that is % ', old.status;
    end if;
    if v_role not in ('authenticated','agent_worker') then
      raise exception 'role % may not edit message content', coalesce(v_role,'<none>');
    end if;
    new.content_hash := v_new_hash;
    -- Any approval is for the old text; send it back for review.
    if old.status in ('approved','scheduled','failed') and new.status = old.status then
      new.status := 'pending_approval';
    end if;
  else
    new.content_hash := old.content_hash;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft'            and new.status in ('pending_approval','cancelled')) or
      (old.status = 'pending_approval' and new.status in ('draft','approved','rejected','cancelled')) or
      (old.status = 'approved'         and new.status in ('pending_approval','scheduled','sending','cancelled')) or
      (old.status = 'scheduled'        and new.status in ('pending_approval','sending','cancelled')) or
      (old.status = 'sending'          and new.status in ('sent','failed')) or
      (old.status = 'failed'           and new.status in ('pending_approval','scheduled','cancelled')) or
      (old.status = 'rejected'         and new.status in ('draft','cancelled'))
    ) then
      raise exception 'invalid outbound transition % -> %', old.status, new.status;
    end if;

    -- Approve / reject only by recording an approval for this exact content.
    if new.status in ('approved','rejected') and not exists (
        select 1 from public.approvals a
         where a.subject_type = 'outbound_message' and a.subject_id = new.id
           and a.user_id = new.user_id and a.content_hash = new.content_hash
           and a.decision::text = new.status::text) then
      raise exception 'status % can only be set by recording an approval', new.status;
    end if;

    if new.status in ('sending','sent','failed') and v_role is distinct from 'dispatcher' then
      raise exception 'only the dispatcher may move a message to %', new.status;
    end if;
    if new.status = 'scheduled' and v_role not in ('authenticated','dispatcher') then
      raise exception 'only the user or dispatcher may schedule a message';
    end if;

    if new.status = 'sending' then
      new.send_started_at := now();
      perform public.fn_assert_send_allowed(new);
    end if;
    if new.status = 'sent' then
      new.sent_at := now();
    end if;
  end if;

  return new;
end $$;

-- Approvals: only the human user, only for the exact current content.
create or replace function public.fn_approval_guard()
returns trigger language plpgsql set search_path = '' as $$
declare m public.outbound_messages;
begin
  if public.fn_request_role() is distinct from 'authenticated' or auth.uid() is null then
    raise exception 'APPROVAL_DENIED: approvals can only be recorded by the signed-in user';
  end if;
  if new.decided_by is distinct from auth.uid() or new.user_id is distinct from auth.uid() then
    raise exception 'APPROVAL_DENIED: approval must be recorded by its owner';
  end if;
  new.decided_at := now();

  select * into m from public.outbound_messages where id = new.subject_id for update;
  if m.id is null or m.user_id <> new.user_id then
    raise exception 'APPROVAL_DENIED: message not found';
  end if;
  if m.status <> 'pending_approval' then
    raise exception 'APPROVAL_DENIED: message is %, not pending_approval', m.status;
  end if;
  if m.content_hash <> new.content_hash then
    raise exception 'APPROVAL_DENIED: message changed since it was shown to you';
  end if;
  if new.decision = 'approved' then
    if public.fn_unverified_citations(m.id) > 0 then
      raise exception 'APPROVAL_DENIED: message cites unverified profile facts';
    end if;
    if m.category in ('offer_negotiation','offer_response','immigration_representation','withdrawal')
       and not new.binding_acknowledged then
      raise exception 'APPROVAL_DENIED: % requires explicit acknowledgement', m.category;
    end if;
  end if;
  return new;
end $$;

create or replace function public.fn_apply_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.outbound_messages
     set status = case new.decision when 'approved' then 'approved'::public.outbound_status
                                    else 'rejected'::public.outbound_status end
   where id = new.subject_id;
  return new;
end $$;

create or replace function public.fn_immutable_row()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% rows are immutable', tg_table_name;
end $$;

-- Inbound mail that asks to stop → suppression list automatically.
create or replace function public.fn_auto_suppress()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.direction = 'inbound' and new.classification in ('unsubscribe_request','bounce')
     and (tg_op = 'INSERT' or old.classification is distinct from new.classification) then
    insert into public.suppression_list (user_id, email, reason)
    values (new.user_id, lower(trim(new.from_address)),
            case new.classification when 'bounce' then 'bounce'::public.suppression_reason
                                    else 'unsubscribe'::public.suppression_reason end)
    on conflict do nothing;
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Emergency pause
-- -----------------------------------------------------------------------------
create or replace function public.emergency_pause(p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text := public.fn_request_role();
begin
  if v_role = 'authenticated' and auth.uid() is not null then
    insert into public.user_controls (user_id, agents_paused, outbound_paused, pause_reason)
    values (auth.uid(), true, true, p_reason)
    on conflict (user_id) do update
      set agents_paused = true, outbound_paused = true, pause_reason = excluded.pause_reason;
    update public.agent_tasks set status = 'cancelled', last_error = 'emergency pause'
     where user_id = auth.uid() and status = 'queued';
  elsif v_role = 'service_role' then
    update public.platform_controls set agents_paused = true, outbound_paused = true, reason = p_reason
     where id = 1;
  else
    raise exception 'role % may not trigger the pause', coalesce(v_role,'<none>');
  end if;
end $$;

create or replace function public.emergency_resume()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.fn_request_role() is distinct from 'authenticated' or auth.uid() is null then
    raise exception 'only the user can resume their agents';
  end if;
  update public.user_controls
     set agents_paused = false, outbound_paused = false, pause_reason = null
   where user_id = auth.uid();
end $$;

-- Workers claim tasks through this; paused users and a paused platform get nothing.
create or replace function public.claim_agent_task(p_worker text, p_agents public.agent_name[] default null)
returns setof public.agent_tasks language plpgsql security definer set search_path = '' as $$
begin
  if public.fn_request_role() is distinct from 'agent_worker' then
    raise exception 'only agent workers may claim tasks';
  end if;
  if (select agents_paused from public.platform_controls where id = 1) then
    return;
  end if;
  return query
  update public.agent_tasks t
     set status = 'running', locked_at = now(), locked_by = p_worker, attempts = t.attempts + 1
   where t.id = (
     select q.id from public.agent_tasks q
      where q.status = 'queued' and q.run_after <= now()
        and q.attempts < q.max_attempts
        and (p_agents is null or q.agent = any (p_agents))
        and not exists (select 1 from public.user_controls u
                        where u.user_id = q.user_id and u.agents_paused)
      order by q.run_after
      for update skip locked
      limit 1)
  returning t.*;
end $$;

-- -----------------------------------------------------------------------------
-- Sponsorship summary: never upgrades historical evidence into "willing"
-- -----------------------------------------------------------------------------
create view public.v_employer_sponsorship with (security_invoker = true) as
select
  e.id as employer_id,
  e.user_id,
  e.name,
  coalesce(sum(se.filing_count) filter (where se.strength = 'historical'), 0) as historical_filings,
  max(se.fiscal_year) filter (where se.strength = 'historical') as latest_filing_fy,
  array_remove(array_agg(distinct se.visa_class) filter (where se.strength = 'historical'), null) as historical_visa_classes,
  bool_or(se.evidence_type = 'job_posting_offers' or se.evidence_type = 'employer_public_policy') as public_statement_offers,
  bool_or(se.evidence_type = 'job_posting_declines') as public_statement_declines,
  bool_or(se.strength = 'direct_confirmation') as confirmed_in_writing,
  case
    when bool_or(se.strength = 'direct_confirmation') then 'confirmed_in_writing'
    when bool_or(se.evidence_type = 'job_posting_declines') then 'publicly_declines'
    when bool_or(se.evidence_type in ('job_posting_offers','employer_public_policy')) then 'publicly_states_sponsorship'
    when bool_or(se.strength = 'historical') then 'historical_sponsor_only'
    else 'no_evidence'
  end as sponsorship_signal
from public.employers e
left join public.sponsorship_evidence se on se.employer_id = e.id
group by e.id, e.user_id, e.name;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.fn_set_updated_at();
create trigger trg_employment_updated before update on public.employment_history for each row execute function public.fn_set_updated_at();
create trigger trg_achievements_updated before update on public.employment_achievements for each row execute function public.fn_set_updated_at();
create trigger trg_qualifications_updated before update on public.qualifications for each row execute function public.fn_set_updated_at();
create trigger trg_prefs_updated before update on public.career_preferences for each row execute function public.fn_set_updated_at();
create trigger trg_employers_updated before update on public.employers for each row execute function public.fn_set_updated_at();
create trigger trg_jobs_updated before update on public.job_opportunities for each row execute function public.fn_set_updated_at();
create trigger trg_contacts_updated before update on public.contacts for each row execute function public.fn_set_updated_at();
create trigger trg_milestones_updated before update on public.immigration_milestones for each row execute function public.fn_set_updated_at();
create trigger trg_applications_updated before update on public.applications for each row execute function public.fn_set_updated_at();
create trigger trg_interviews_updated before update on public.interviews for each row execute function public.fn_set_updated_at();
create trigger trg_offers_updated before update on public.offers for each row execute function public.fn_set_updated_at();
create trigger trg_actions_updated before update on public.action_items for each row execute function public.fn_set_updated_at();
create trigger trg_outbound_updated before update on public.outbound_messages for each row execute function public.fn_set_updated_at();
create trigger trg_tasks_updated before update on public.agent_tasks for each row execute function public.fn_set_updated_at();
create trigger trg_user_controls_updated before update on public.user_controls for each row execute function public.fn_set_updated_at();

create trigger trg_verify_employment before insert or update on public.employment_history for each row execute function public.fn_guard_verification();
create trigger trg_verify_achievements before insert or update on public.employment_achievements for each row execute function public.fn_guard_verification();
create trigger trg_verify_qualifications before insert or update on public.qualifications for each row execute function public.fn_guard_verification();
create trigger trg_verify_skills before insert or update on public.skills for each row execute function public.fn_guard_verification();

create trigger trg_work_auth before insert or update on public.profiles for each row execute function public.fn_guard_work_authorization();
create trigger trg_user_controls_guard before insert or update on public.user_controls for each row execute function public.fn_guard_user_controls();
create trigger trg_platform_controls_guard before update on public.platform_controls for each row execute function public.fn_guard_platform_controls();
create trigger trg_application_status before insert or update on public.applications for each row execute function public.fn_guard_application_status();
create trigger trg_offer_status before insert or update on public.offers for each row execute function public.fn_guard_offer_status();

create trigger trg_outbound_guard before insert or update on public.outbound_messages for each row execute function public.fn_outbound_guard();
create trigger trg_approval_guard before insert on public.approvals for each row execute function public.fn_approval_guard();
create trigger trg_approval_apply after insert on public.approvals for each row execute function public.fn_apply_approval();
create trigger trg_approval_immutable before update or delete on public.approvals for each row execute function public.fn_immutable_row();
create trigger trg_auto_suppress after insert or update on public.email_messages for each row execute function public.fn_auto_suppress();

-- Audit every table that holds decisions, facts or correspondence.
do $$
declare t text;
begin
  foreach t in array array[
    'platform_controls','user_controls','profiles','cv_documents','employment_history',
    'employment_achievements','qualifications','skills','career_preferences','employers',
    'job_opportunities','contacts','suppression_list','sponsorship_evidence',
    'immigration_pathway_assessments','immigration_milestones','applications','interviews',
    'offers','action_items','mail_accounts','email_threads','email_messages',
    'outbound_messages','message_fact_citations','approvals','agent_tasks']
  loop
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function public.fn_audit_row()', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Row-level security and grants
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;

do $$
declare t text;
begin
  -- Owner-scoped tables: the user has full CRUD on their own rows.
  foreach t in array array[
    'profiles','cv_documents','employment_history','employment_achievements','qualifications',
    'skills','career_preferences','employers','job_opportunities','contacts','suppression_list',
    'sponsorship_evidence','immigration_pathway_assessments','immigration_milestones',
    'applications','interviews','offers','action_items','email_threads','email_messages',
    'outbound_messages','message_fact_citations','agent_tasks']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner_all on public.%I for all to authenticated
                    using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;

  -- Agents: read and draft, across users (single-tenant deployment; see ADR-006).
  foreach t in array array[
    'profiles','employment_history','employment_achievements','qualifications','skills',
    'career_preferences','employers','job_opportunities','contacts','suppression_list',
    'sponsorship_evidence','immigration_pathway_assessments','immigration_milestones',
    'applications','interviews','offers','action_items','email_threads','email_messages',
    'outbound_messages','message_fact_citations','agent_tasks','agent_runs','user_controls',
    'cv_documents']
  loop
    execute format('create policy agent_all on public.%I for all to agent_worker using (true) with check (true)', t);
    execute format('grant select on public.%I to agent_worker', t);
  end loop;
end $$;

grant insert, update on public.employment_history, public.employment_achievements, public.qualifications,
  public.skills, public.employers, public.job_opportunities, public.contacts,
  public.sponsorship_evidence, public.immigration_pathway_assessments, public.immigration_milestones,
  public.applications, public.interviews, public.offers, public.action_items,
  public.email_threads, public.email_messages, public.outbound_messages,
  public.message_fact_citations, public.agent_tasks, public.agent_runs to agent_worker;
grant insert on public.suppression_list to agent_worker;
-- Agents never see OAuth tokens and cannot write approvals or controls.

alter table public.user_controls enable row level security;
create policy owner_select on public.user_controls for select to authenticated using (user_id = auth.uid());
create policy owner_insert on public.user_controls for insert to authenticated with check (user_id = auth.uid());
create policy owner_update on public.user_controls for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.user_controls to authenticated;
create policy dispatcher_select on public.user_controls for select to dispatcher using (true);
grant select on public.user_controls to dispatcher;

alter table public.platform_controls enable row level security;
create policy read_all on public.platform_controls for select to authenticated, agent_worker, dispatcher using (true);
grant select on public.platform_controls to authenticated, agent_worker, dispatcher;

alter table public.approvals enable row level security;
create policy owner_select on public.approvals for select to authenticated using (user_id = auth.uid());
create policy owner_insert on public.approvals for insert to authenticated with check (user_id = auth.uid() and decided_by = auth.uid());
grant select, insert on public.approvals to authenticated;
create policy read_all on public.approvals for select to agent_worker, dispatcher using (true);
grant select on public.approvals to agent_worker, dispatcher;

alter table public.mail_accounts enable row level security;
create policy owner_select on public.mail_accounts for select to authenticated using (user_id = auth.uid());
create policy owner_delete on public.mail_accounts for delete to authenticated using (user_id = auth.uid());
-- Users see metadata, not ciphertext. Token writes happen server-side (service_role).
grant select (id, user_id, provider, email_address, scopes, status, connected_at, revoked_at)
  on public.mail_accounts to authenticated;
grant delete on public.mail_accounts to authenticated;
create policy dispatcher_all on public.mail_accounts for all to dispatcher using (true) with check (true);
grant select, update (status, sync_cursor, revoked_at) on public.mail_accounts to dispatcher;

alter table public.agent_runs enable row level security;
create policy owner_select on public.agent_runs for select to authenticated using (user_id = auth.uid());
grant select on public.agent_runs to authenticated;

alter table public.audit_log enable row level security;
create policy owner_select on public.audit_log for select to authenticated using (user_id = auth.uid());
grant select on public.audit_log to authenticated;
revoke insert, update, delete, truncate on public.audit_log from authenticated, agent_worker, dispatcher;

-- Dispatcher: send approved mail, record what came back.
create policy dispatcher_all on public.outbound_messages for all to dispatcher using (true) with check (true);
grant select, update on public.outbound_messages to dispatcher;
do $$
declare t text;
begin
  foreach t in array array['suppression_list','email_threads','email_messages']
  loop
    execute format('create policy dispatcher_all on public.%I for all to dispatcher using (true) with check (true)', t);
    execute format('grant select on public.%I to dispatcher', t);
  end loop;
end $$;
grant insert, update on public.email_threads, public.email_messages to dispatcher;
grant insert on public.suppression_list to dispatcher;

-- Reference data: readable by everyone signed in, written by operator jobs.
alter table public.ref_authoritative_sources enable row level security;
alter table public.ref_dol_disclosures enable row level security;
create policy read_all on public.ref_authoritative_sources for select to authenticated, agent_worker using (true);
create policy read_all on public.ref_dol_disclosures for select to authenticated, agent_worker using (true);
create policy agent_insert on public.ref_authoritative_sources for insert to agent_worker with check (true);
grant select on public.ref_authoritative_sources, public.ref_dol_disclosures to authenticated, agent_worker;
grant insert on public.ref_authoritative_sources to agent_worker;

grant select on public.v_employer_sponsorship to authenticated, agent_worker;
grant usage, select on all sequences in schema public to authenticated, agent_worker, dispatcher;

grant execute on function public.emergency_pause(text) to authenticated, service_role;
grant execute on function public.emergency_resume() to authenticated;
grant execute on function public.claim_agent_task(text, public.agent_name[]) to agent_worker;
grant execute on function public.fn_verify_audit_chain(uuid) to authenticated, service_role;
grant execute on function public.fn_request_role(), public.fn_actor_type(), public.fn_email_domain(text),
  public.fn_outbound_hash(public.outbound_messages), public.fn_unverified_citations(uuid)
  to authenticated, agent_worker, dispatcher, service_role;
-- The send gate runs inside the dispatcher's status update.
grant execute on function public.fn_assert_send_allowed(public.outbound_messages) to dispatcher;
