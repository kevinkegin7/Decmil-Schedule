-- =============================================================================
-- HSEQ USA Career Agent — Milestone 1: foundation and career profile
--
-- Tables: profiles, career_profiles, employment_history, qualifications,
--         career_preferences, audit_logs, user_controls
-- Storage: private bucket "qualification-evidence", owner-only policies
--
-- Rules enforced here (not only in the app):
--   * RLS: a user can only see and change their own rows.
--   * Qualifications are never verified automatically: inserts are forced to
--     'unverified'; editing a verified qualification sends it back.
--   * A career profile cannot be marked complete while any imported record
--     still needs review.
--   * audit_logs is append-only and hash-chained; users can only read it.
--   * External communications stay locked off in Milestone 1 (CHECK).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Reference lists (kept in SQL so CHECK constraints and the app agree;
-- the app mirrors them in src/lib/config/reference-data.ts, tested for parity)
-- -----------------------------------------------------------------------------
create or replace function public.us_state_codes()
returns text[] language sql immutable parallel safe set search_path = '' as $$
  select array[
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
    'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
    'VA','WA','WV','WI','WY','DC']
$$;

create or replace function public.industry_codes()
returns text[] language sql immutable parallel safe set search_path = '' as $$
  select array['mining','construction','energy','renewable_energy','oil_and_gas',
               'infrastructure','manufacturing','other']
$$;

create or replace function public.fn_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- profiles — identity and headline information (1:1 with auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  full_name             text check (char_length(full_name) <= 120),
  email                 text check (char_length(email) <= 254 and (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  current_location      text check (char_length(current_location) <= 120),
  current_employer      text check (char_length(current_employer) <= 120),
  current_job_title     text check (char_length(current_job_title) <= 120),
  professional_summary  text check (char_length(professional_summary) <= 600),   -- headline
  linkedin_url          text check (linkedin_url is null or linkedin_url ~ '^https://([a-z]{2,3}\.)?linkedin\.com/'),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- career_profiles — detailed professional profile (1:1 with user)
-- -----------------------------------------------------------------------------
create table public.career_profiles (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null unique references auth.users (id) on delete cascade,
  total_experience_years          integer check (total_experience_years between 0 and 60),
  australian_experience_years     integer check (australian_experience_years between 0 and 60),
  international_experience_years  integer check (international_experience_years between 0 and 60),
  primary_industries              text[] not null default '{}' check (primary_industries <@ public.industry_codes()),
  target_job_titles               text[] not null default array[
                                    'Senior HSEQ Advisor','HSEQ Manager','EHS Manager','Safety Manager',
                                    'Construction Safety Manager','Mining Safety Manager'],
  core_competencies               text[] not null default '{}' check (cardinality(core_competencies) <= 60),
  professional_summary            text check (char_length(professional_summary) <= 4000),  -- detailed
  education_summary               text check (char_length(education_summary) <= 2000),
  profile_status                  text not null default 'draft'
                                    check (profile_status in ('draft','in_review','complete')),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  constraint experience_split_within_total check (
    total_experience_years is null
    or coalesce(australian_experience_years, 0) + coalesce(international_experience_years, 0) <= total_experience_years)
);

-- -----------------------------------------------------------------------------
-- employment_history
-- start_date is nullable only so imported records with unknown dates can be
-- stored for review; the app requires it when the user saves the record.
-- -----------------------------------------------------------------------------
create table public.employment_history (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  employer_name     text not null check (char_length(employer_name) between 1 and 160),
  job_title         text not null check (char_length(job_title) between 1 and 160),
  industry          text check (industry is null or industry = any (public.industry_codes())),
  project_name      text check (char_length(project_name) <= 200),
  country           text check (char_length(country) <= 80),
  location          text check (char_length(location) <= 120),
  start_date        date,
  end_date          date,
  is_current        boolean not null default false,
  responsibilities  text check (char_length(responsibilities) <= 6000),
  achievements      text check (char_length(achievements) <= 6000),
  needs_review      boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint end_after_start check (end_date is null or start_date is null or end_date >= start_date),
  constraint current_has_no_end check (not is_current or end_date is null)
);
create index employment_history_user_idx on public.employment_history (user_id, start_date desc);

-- -----------------------------------------------------------------------------
-- qualifications
-- -----------------------------------------------------------------------------
create table public.qualifications (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  qualification_name     text not null check (char_length(qualification_name) between 1 and 200),
  awarding_organisation  text not null check (char_length(awarding_organisation) between 1 and 200),
  qualification_type     text not null check (qualification_type in
                           ('degree','diploma','certificate','licence','training','membership','other')),
  country                text check (char_length(country) <= 80),
  issue_date             date,
  expiry_date            date,
  verification_status    text not null default 'unverified'
                           check (verification_status in ('unverified','user_verified','document_verified')),
  verified_at            timestamptz,
  evidence_file_path     text,
  needs_review           boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint expiry_after_issue check (expiry_date is null or issue_date is null or expiry_date > issue_date),
  constraint evidence_in_owner_folder check (
    evidence_file_path is null or evidence_file_path like user_id::text || '/%'),
  constraint document_verified_needs_evidence check (
    verification_status <> 'document_verified' or evidence_file_path is not null)
);
create index qualifications_user_idx on public.qualifications (user_id);

-- -----------------------------------------------------------------------------
-- career_preferences (1:1 with user). Defaults are the owner's initial settings.
-- -----------------------------------------------------------------------------
create table public.career_preferences (
  id                             uuid primary key default gen_random_uuid(),
  user_id                        uuid not null unique references auth.users (id) on delete cascade,
  target_salary_min              numeric(12,2) not null default 120000 check (target_salary_min > 0),
  target_salary_max              numeric(12,2) not null default 150000 check (target_salary_max <= 2000000),
  salary_currency                text not null default 'USD' check (salary_currency = 'USD'),
  salary_period                  text not null default 'annual' check (salary_period = 'annual'),
  salary_basis_note              text not null default 'Annual base salary, excluding bonus and benefits',
  preferred_states               text[] not null default array[
                                   'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
                                   'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
                                   'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
                                   'VA','WA','WV','WI','WY']
                                   check (preferred_states <@ public.us_state_codes()),
  preferred_industries           text[] not null default array[
                                   'mining','construction','energy','renewable_energy','oil_and_gas',
                                   'infrastructure','manufacturing']
                                   check (preferred_industries <@ public.industry_codes()),
  preferred_job_titles           text[] not null default array[
                                   'Senior HSEQ Advisor','HSEQ Manager','EHS Manager','Safety Manager',
                                   'Construction Safety Manager','Mining Safety Manager'],
  relocation_willingness         boolean not null default true,
  rotational_work_preference     boolean not null default true,
  residential_work_preference    boolean not null default true,
  employer_sponsorship_required  boolean not null default true,
  preferred_email_provider       text not null default 'outlook' check (preferred_email_provider in ('outlook','gmail')),
  email_autonomy                 text not null default 'approval_then_limited_followups'
                                   check (email_autonomy in ('approval_required_all','approval_then_limited_followups')),
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),
  constraint salary_min_not_above_max check (target_salary_min <= target_salary_max)
);

-- -----------------------------------------------------------------------------
-- user_controls — emergency pause and the external-comms lock
-- -----------------------------------------------------------------------------
create table public.user_controls (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  agents_paused           boolean not null default false,
  outbound_paused         boolean not null default false,
  pause_reason            text check (char_length(pause_reason) <= 500),
  paused_at               timestamptz,
  -- Milestone 1: no external communications. A later migration removes this lock
  -- only after the user approves enabling email (see docs/ROADMAP.md).
  external_comms_enabled  boolean not null default false
                            constraint external_comms_locked_in_m1 check (external_comms_enabled = false),
  updated_at              timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- audit_logs — append-only, SHA-256 hash chain per user
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  seq          bigint generated always as identity unique,
  user_id      uuid,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  details      jsonb not null default '{}',
  created_at   timestamptz not null default clock_timestamp(),
  prev_hash    text not null,
  hash         text not null
);
create index audit_logs_user_idx on public.audit_logs (user_id, seq);

create or replace function public.fn_audit_hash(
  p_prev text, p_user uuid, p_action text, p_entity_type text, p_entity_id uuid,
  p_details jsonb, p_created timestamptz)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(
    p_prev || '|' || coalesce(p_user::text, '') || '|' || p_action || '|' || p_entity_type || '|' ||
    coalesce(p_entity_id::text, '') || '|' || p_details::text || '|' || p_created::text, 'sha256'), 'hex')
$$;

-- The only writer of audit_logs. SECURITY DEFINER so it works even though
-- application users have no INSERT privilege on the table.
create or replace function public.fn_audit_append(
  p_user uuid, p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_prev text;
  v_ts   timestamptz := clock_timestamp();
  v_det  jsonb := coalesce(p_details, '{}'::jsonb)
                  || jsonb_build_object('actor_role', coalesce(auth.role(), 'system'));
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_user::text, 'system'), 0));
  select hash into v_prev from public.audit_logs
   where user_id is not distinct from p_user order by seq desc limit 1;
  v_prev := coalesce(v_prev, 'GENESIS');
  insert into public.audit_logs (user_id, action, entity_type, entity_id, details, created_at, prev_hash, hash)
  values (p_user, p_action, p_entity_type, p_entity_id, v_det, v_ts, v_prev,
          public.fn_audit_hash(v_prev, p_user, p_action, p_entity_type, p_entity_id, v_det, v_ts));
end $$;

-- Long free-text fields are recorded as a hash + length, not copied, so the
-- audit log does not become a second copy of the user's narrative text.
create or replace function public.fn_audit_redact(p jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare k text; r jsonb := p;
begin
  if r is null then return null; end if;
  foreach k in array array['professional_summary','responsibilities','achievements','education_summary'] loop
    if r ? k and r ->> k is not null then
      r := jsonb_set(r, array[k], jsonb_build_object(
             'sha256', encode(extensions.digest(r ->> k, 'sha256'), 'hex'),
             'length', char_length(r ->> k)));
    end if;
  end loop;
  return r - 'created_at' - 'updated_at';
end $$;

create or replace function public.fn_audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then public.fn_audit_redact(to_jsonb(old)) end;
  v_new jsonb := case when tg_op <> 'DELETE' then public.fn_audit_redact(to_jsonb(new)) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_user uuid := coalesce((v_row ->> 'user_id')::uuid, (v_row ->> 'id')::uuid);
  v_entity uuid := coalesce((v_row ->> 'id')::uuid, (v_row ->> 'user_id')::uuid);
  v_changed text[];
  v_details jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key order by key), '{}') into v_changed
      from jsonb_each(v_new) n
     where n.value is distinct from v_old -> n.key;
    if cardinality(v_changed) = 0 then
      return new;   -- nothing but timestamps changed
    end if;
    v_details := jsonb_build_object(
      'changed_fields', to_jsonb(v_changed),
      'before', (select jsonb_object_agg(k, v_old -> k) from unnest(v_changed) k),
      'after',  (select jsonb_object_agg(k, v_new -> k) from unnest(v_changed) k));
  elsif tg_op = 'INSERT' then
    v_details := jsonb_build_object('after', v_new);
  else
    v_details := jsonb_build_object('before', v_old);
  end if;
  perform public.fn_audit_append(v_user, tg_table_name || '.' || lower(tg_op), tg_table_name, v_entity, v_details);
  return coalesce(new, old);
end $$;

create or replace function public.fn_audit_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs is append-only';
end $$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.fn_audit_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function public.fn_audit_immutable();

-- Application events that are not row changes (sign-in, sign-out, uploads).
create or replace function public.log_audit_event(
  p_action text, p_entity_type text, p_entity_id uuid default null, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_action !~ '^app\.[a-z_]+\.[a-z_]+$' then
    raise exception 'invalid audit action %', p_action;
  end if;
  if pg_column_size(p_details) > 4096 then
    raise exception 'audit details too large';
  end if;
  perform public.fn_audit_append(auth.uid(), p_action, p_entity_type, p_entity_id, p_details);
end $$;

-- Recompute a user's chain; returns the seq of the first broken row, or NULL.
create or replace function public.verify_audit_chain()
returns bigint language plpgsql stable security definer set search_path = '' as $$
declare r record; v_prev text := 'GENESIS';
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  for r in select * from public.audit_logs where user_id = auth.uid() order by seq loop
    if r.prev_hash <> v_prev
       or r.hash <> public.fn_audit_hash(v_prev, r.user_id, r.action, r.entity_type, r.entity_id, r.details, r.created_at) then
      return r.seq;
    end if;
    v_prev := r.hash;
  end loop;
  return null;
end $$;

-- -----------------------------------------------------------------------------
-- Guards
-- -----------------------------------------------------------------------------

-- Qualifications are never verified automatically.
create or replace function public.fn_qualification_verification()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.verification_status := 'unverified';
    new.verified_at := null;
    return new;
  end if;

  if old.verification_status <> 'unverified'
     and new.verification_status = old.verification_status
     and (new.qualification_name, new.awarding_organisation, new.qualification_type, new.country,
          new.issue_date, new.expiry_date, new.evidence_file_path)
         is distinct from
         (old.qualification_name, old.awarding_organisation, old.qualification_type, old.country,
          old.issue_date, old.expiry_date, old.evidence_file_path) then
    -- A verified record was edited: it must be re-verified.
    new.verification_status := 'unverified';
  end if;

  if new.verification_status <> 'unverified' then
    if new.needs_review then
      raise exception 'review this qualification before verifying it';
    end if;
    if old.verification_status is distinct from new.verification_status then
      new.verified_at := now();
    end if;
  else
    new.verified_at := null;
  end if;
  return new;
end $$;

-- A profile can only be marked complete once every imported record is reviewed.
create or replace function public.fn_career_profile_completion()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.profile_status = 'complete' and (tg_op = 'INSERT' or old.profile_status <> 'complete') then
    if exists (select 1 from public.employment_history where user_id = new.user_id and needs_review)
       or exists (select 1 from public.qualifications where user_id = new.user_id and needs_review) then
      raise exception 'PROFILE_INCOMPLETE: review every imported record before marking the profile complete';
    end if;
    if exists (select 1 from public.employment_history where user_id = new.user_id and start_date is null) then
      raise exception 'PROFILE_INCOMPLETE: every employment record needs a start date';
    end if;
    if not exists (select 1 from public.profiles
                    where id = new.user_id and coalesce(btrim(full_name), '') <> '' and email is not null) then
      raise exception 'PROFILE_INCOMPLETE: full name and email are required';
    end if;
  end if;
  return new;
end $$;

create or replace function public.fn_user_controls_pause()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.agents_paused or new.outbound_paused)
     and (tg_op = 'INSERT' or not (old.agents_paused or old.outbound_paused)) then
    new.paused_at := now();
  elsif not (new.agents_paused or new.outbound_paused) then
    new.paused_at := null;
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.fn_set_updated_at();
create trigger trg_career_profiles_updated before update on public.career_profiles for each row execute function public.fn_set_updated_at();
create trigger trg_employment_updated before update on public.employment_history for each row execute function public.fn_set_updated_at();
create trigger trg_qualifications_updated before update on public.qualifications for each row execute function public.fn_set_updated_at();
create trigger trg_preferences_updated before update on public.career_preferences for each row execute function public.fn_set_updated_at();
create trigger trg_user_controls_updated before update on public.user_controls for each row execute function public.fn_set_updated_at();

create trigger trg_qualification_verification before insert or update on public.qualifications
  for each row execute function public.fn_qualification_verification();
create trigger trg_career_profile_completion before insert or update on public.career_profiles
  for each row execute function public.fn_career_profile_completion();
create trigger trg_user_controls_pause before insert or update on public.user_controls
  for each row execute function public.fn_user_controls_pause();

do $$
declare t text;
begin
  foreach t in array array['profiles','career_profiles','employment_history','qualifications',
                           'career_preferences','user_controls'] loop
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function public.fn_audit_row()', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- No delete policy: a profile is removed only by deleting the auth user (cascade).
grant select, insert, update on public.profiles to authenticated;

do $$
declare t text;
begin
  foreach t in array array['career_profiles','employment_history','qualifications','career_preferences','user_controls'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
  foreach t in array array['employment_history','qualifications'] loop
    execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t || '_delete', t);
    execute format('grant delete on public.%I to authenticated', t);
  end loop;
end $$;

alter table public.audit_logs enable row level security;
create policy audit_logs_select on public.audit_logs for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;

grant execute on function public.us_state_codes(), public.industry_codes() to authenticated;
grant execute on function public.log_audit_event(text, text, uuid, jsonb) to authenticated;
grant execute on function public.verify_audit_chain() to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: private bucket for qualification evidence
-- Object names must start with the owner's user id: "<uid>/<qualification id>/<file>"
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qualification-evidence', 'qualification-evidence', false, 10485760,
        array['application/pdf','image/png','image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy evidence_select_own on storage.objects for select to authenticated
  using (bucket_id = 'qualification-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy evidence_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'qualification-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy evidence_update_own on storage.objects for update to authenticated
  using (bucket_id = 'qualification-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'qualification-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy evidence_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'qualification-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- -----------------------------------------------------------------------------
-- Starter profile for the project owner.
-- Contains only facts the owner supplied. No dates, certificate numbers,
-- memberships or achievements are invented. Every imported record is flagged
-- needs_review and every qualification is unverified.
-- Idempotent: only fills empty fields and only adds records if none exist.
-- -----------------------------------------------------------------------------
create or replace function public.load_starter_profile()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_added_employment int := 0;
  v_added_qualifications int := 0;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  insert into public.profiles (id, email) values (v_uid, v_email) on conflict (id) do nothing;
  update public.profiles set
    current_location     = coalesce(current_location, 'Australia'),
    current_employer     = coalesce(current_employer, 'Decmil'),
    current_job_title    = coalesce(current_job_title, 'HSE Advisor'),
    professional_summary = coalesce(professional_summary,
      'Australian-based HSEQ professional with experience in mining, construction, renewable energy and infrastructure.')
  where id = v_uid;

  insert into public.career_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;
  update public.career_profiles set
    primary_industries = case when cardinality(primary_industries) = 0
                              then array['mining','construction','renewable_energy','infrastructure']
                              else primary_industries end,
    education_summary  = coalesce(education_summary,
      'Bachelor''s degree in Occupational Safety and Health, Curtin University.')
  where user_id = v_uid;

  insert into public.career_preferences (user_id) values (v_uid) on conflict (user_id) do nothing;
  insert into public.user_controls (user_id) values (v_uid) on conflict (user_id) do nothing;

  if not exists (select 1 from public.employment_history where user_id = v_uid) then
    insert into public.employment_history (user_id, employer_name, job_title, country, is_current, needs_review)
    values (v_uid, 'Decmil', 'HSE Advisor', 'Australia', true, true);
    v_added_employment := 1;
  end if;

  if not exists (select 1 from public.qualifications where user_id = v_uid) then
    insert into public.qualifications (user_id, qualification_name, awarding_organisation, qualification_type, country, needs_review)
    values
      (v_uid, 'Bachelor''s degree — Occupational Safety and Health (confirm exact title)', 'Curtin University', 'degree', 'Australia', true),
      (v_uid, 'NEBOSH qualification (confirm exact title)', 'NEBOSH', 'certificate', null, true),
      (v_uid, 'ICAM credential (confirm exact title)', 'To be confirmed', 'training', null, true);
    v_added_qualifications := 3;
  end if;

  perform public.log_audit_event('app.profile.starter_loaded', 'profiles', v_uid,
    jsonb_build_object('employment_added', v_added_employment, 'qualifications_added', v_added_qualifications));

  return jsonb_build_object('employment_added', v_added_employment, 'qualifications_added', v_added_qualifications);
end $$;

grant execute on function public.load_starter_profile() to authenticated;
