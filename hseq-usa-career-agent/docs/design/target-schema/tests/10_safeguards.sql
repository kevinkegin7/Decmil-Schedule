-- Safeguard tests for 0001_initial_schema.sql.
-- Each test acts as a specific request role (user, agent, dispatcher, operator)
-- by setting the JWT claims and the Postgres role, exactly as PostgREST does.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = warning;
\o /dev/null

create schema tests;
create function tests.expect_error(p_sql text, p_pattern text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm !~* p_pattern then
      raise exception 'FAIL: expected error /%/ but got: %', p_pattern, sqlerrm;
    end if;
    raise warning 'PASS blocked: %', left(sqlerrm, 110);
    return;
  end;
  raise exception 'FAIL: expected error /%/ but statement succeeded: %', p_pattern, p_sql;
end $$;
create function tests.ok(p_cond boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FAIL: %', p_label; end if;
  raise warning 'PASS: %', p_label;
end $$;
grant usage on schema tests to public;
grant execute on all functions in schema tests to public;

-- Fixtures --------------------------------------------------------------------
\set U1 '''11111111-1111-1111-1111-111111111111'''
\set U2 '''22222222-2222-2222-2222-222222222222'''
\set AS_USER1  'set request.jwt.claims = ''{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}''; set role authenticated;'
\set AS_USER2  'set request.jwt.claims = ''{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}''; set role authenticated;'
\set AS_AGENT  'set request.jwt.claims = ''{"role":"agent_worker","agent":"employer_outreach"}''; set role agent_worker;'
\set AS_DISP   'set request.jwt.claims = ''{"role":"dispatcher"}''; set role dispatcher;'
\set AS_OPS    'set request.jwt.claims = ''{"role":"service_role"}''; set role service_role;'
\set AS_ROOT   'reset role; reset request.jwt.claims;'

insert into auth.users (id, email) values (:U1, 'u1@example.test'), (:U2, 'u2@example.test');

:AS_OPS
update public.platform_controls set external_comms_enabled = true where id = 1;
insert into public.mail_accounts (id, user_id, provider, email_address, scopes, encrypted_refresh_token, token_key_id)
values ('aaaaaaaa-0000-0000-0000-000000000001', :U1, 'gmail', 'u1@example.test',
        array['gmail.readonly','gmail.send'], '\x00'::bytea, 'k1');
select tests.expect_error(
  $$insert into public.user_controls (user_id, external_comms_enabled) values ('11111111-1111-1111-1111-111111111111', true)$$,
  'only the user can enable external communications');

:AS_USER1
insert into public.profiles (user_id, full_name) values (:U1, 'Test User');
insert into public.user_controls (user_id) values (:U1);
select tests.expect_error($$update public.platform_controls set outbound_paused = true$$, 'operator-only|permission denied');

-- 1. Verified facts ------------------------------------------------------------
:AS_AGENT
select tests.expect_error(
  $$insert into public.qualifications (user_id, qualification_type, title, issuer, verification_status)
    values ('11111111-1111-1111-1111-111111111111','degree','Invented PhD','Nowhere','user_verified')$$,
  'only the user can create verified facts');
insert into public.qualifications (id, user_id, qualification_type, title, issuer)
values ('bbbbbbbb-0000-0000-0000-000000000001', :U1, 'degree', 'Bachelor of Science (OHS)', 'Example University');
insert into public.skills (id, user_id, name)
values ('bbbbbbbb-0000-0000-0000-000000000002', :U1, 'ISO 45001 lead auditing');
select tests.expect_error(
  $$update public.qualifications set verification_status = 'user_verified' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'only the user can change verification status');

:AS_USER1
update public.qualifications set verification_status = 'user_verified' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.ok((select verified_at is not null from public.qualifications where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'user can verify a qualification; verified_at stamped');
update public.qualifications set title = 'Bachelor of Science (Occupational Health & Safety)' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select tests.ok((select verification_status = 'unverified' from public.qualifications where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'editing a verified fact sends it back to unverified');
update public.qualifications set verification_status = 'user_verified' where id = 'bbbbbbbb-0000-0000-0000-000000000001';

:AS_AGENT
select tests.expect_error(
  $$update public.qualifications set issuer = 'Better University' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  'verified facts can only be edited by the user');

-- 2. Work authorisation --------------------------------------------------------
select tests.expect_error(
  $$update public.profiles set us_work_authorization = 'authorized_unrestricted', work_authorization_evidence_path = 'x'$$,
  'only the user can change US work authorisation|permission denied');
:AS_USER1
select tests.expect_error(
  $$update public.profiles set us_work_authorization = 'authorized_unrestricted'$$,
  'work_auth_needs_evidence');

-- 3. Controls are user-only ----------------------------------------------------
:AS_AGENT
select tests.expect_error($$update public.user_controls set agents_paused = false$$, 'may not change user controls|permission denied');
select tests.expect_error(
  $$insert into public.approvals (user_id, subject_type, subject_id, content_hash, decision, decided_by)
    values ('11111111-1111-1111-1111-111111111111','outbound_message', gen_random_uuid(), 'x','approved','11111111-1111-1111-1111-111111111111')$$,
  'permission denied|APPROVAL_DENIED');

:AS_USER1
update public.user_controls set external_comms_enabled = true, max_initial_outreach_per_day = 1 where user_id = :U1;
select tests.expect_error($$update public.user_controls set max_total_sends_per_day = 500$$, 'check constraint');

-- 4. Employers, contacts -------------------------------------------------------
:AS_AGENT
insert into public.employers (id, user_id, name, normalized_name, email_domain, industries, discovered_by)
values ('cccccccc-0000-0000-0000-000000000001', :U1, 'Example Mining Co', 'example mining co', 'mining.example', '{mining}', 'agent'),
       ('cccccccc-0000-0000-0000-000000000002', :U1, 'Example Energy Inc', 'example energy inc', 'energy.example', '{energy}', 'agent');
select tests.expect_error(
  $$insert into public.contacts (user_id, email, email_source) values ('11111111-1111-1111-1111-111111111111','x@mining.example','company_website')$$,
  'published_source_needs_url');
insert into public.contacts (id, user_id, employer_id, full_name, email, email_source, source_url) values
 ('dddddddd-0000-0000-0000-000000000001', :U1, 'cccccccc-0000-0000-0000-000000000001', 'Recruiter One', 'r1@mining.example', 'job_posting', 'https://mining.example/jobs/1'),
 ('dddddddd-0000-0000-0000-000000000002', :U1, 'cccccccc-0000-0000-0000-000000000001', 'Recruiter Two', 'r2@mining.example', 'job_posting', 'https://mining.example/jobs/2'),
 ('dddddddd-0000-0000-0000-000000000003', :U1, 'cccccccc-0000-0000-0000-000000000002', 'Recruiter Three', 'r3@energy.example', 'company_website', 'https://energy.example/careers');

-- 5. Outbound approval workflow -----------------------------------------------
insert into public.outbound_messages (id, user_id, mail_account_id, employer_id, contact_id, category,
                                      to_addresses, subject, body_text, status, drafted_by)
values ('eeeeeeee-0000-0000-0000-000000000001', :U1, 'aaaaaaaa-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'initial_outreach',
        array['r1@mining.example'], 'Senior HSEQ Advisor — expression of interest', 'Dear Recruiter One, ...',
        'pending_approval', 'agent');
insert into public.message_fact_citations (user_id, outbound_message_id, qualification_id) values
  (:U1, 'eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001');
insert into public.message_fact_citations (id, user_id, outbound_message_id, skill_id) values
  ('ffffffff-0000-0000-0000-000000000001', :U1, 'eeeeeeee-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

select tests.expect_error(
  $$update public.outbound_messages set status = 'approved' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  'can only be set by recording an approval');
select tests.expect_error(
  $$update public.outbound_messages set status = 'sending' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  'invalid outbound transition');

:AS_USER1
select content_hash as h1 from public.outbound_messages where id = 'eeeeeeee-0000-0000-0000-000000000001' \gset
select tests.expect_error(format(
  $$insert into public.approvals (user_id, subject_type, subject_id, content_hash, decision, decided_by)
    values ('11111111-1111-1111-1111-111111111111','outbound_message','eeeeeeee-0000-0000-0000-000000000001','%s','approved','11111111-1111-1111-1111-111111111111')$$, :'h1'),
  'cites unverified profile facts');
select tests.expect_error(
  $$insert into public.approvals (user_id, subject_type, subject_id, content_hash, decision, decided_by)
    values ('11111111-1111-1111-1111-111111111111','outbound_message','eeeeeeee-0000-0000-0000-000000000001','stale','approved','11111111-1111-1111-1111-111111111111')$$,
  'changed since it was shown');
delete from public.message_fact_citations where id = 'ffffffff-0000-0000-0000-000000000001';
insert into public.approvals (user_id, subject_type, subject_id, content_hash, decision, decided_by)
values (:U1, 'outbound_message', 'eeeeeeee-0000-0000-0000-000000000001', :'h1', 'approved', :U1);
select tests.ok((select status = 'approved' from public.outbound_messages where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'user approval of exact content moves message to approved');
select tests.expect_error(
  $$update public.approvals set note = 'tamper'$$, 'immutable|permission denied');

:AS_AGENT
update public.outbound_messages set body_text = 'Dear Recruiter One, ... (agent rewrote this)' where id = 'eeeeeeee-0000-0000-0000-000000000001';
select tests.ok((select status = 'pending_approval' from public.outbound_messages where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'editing an approved message sends it back for approval');

:AS_USER1
select content_hash as h2 from public.outbound_messages where id = 'eeeeeeee-0000-0000-0000-000000000001' \gset
insert into public.approvals (user_id, subject_type, subject_id, content_hash, decision, decided_by)
values (:U1, 'outbound_message', 'eeeeeeee-0000-0000-0000-000000000001', :'h2', 'approved', :U1);
select tests.expect_error(
  $$update public.outbound_messages set status = 'sending' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  'only the dispatcher');

-- 6. Emergency pause blocks dispatch -----------------------------------------
select public.emergency_pause('testing the kill switch');
:AS_DISP
select tests.expect_error(
  $$update public.outbound_messages set status = 'sending' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  'emergency pause is active');
:AS_AGENT
select tests.expect_error($$select public.emergency_resume()$$, 'only the user can resume|permission denied');
:AS_USER1
select public.emergency_resume();

-- 7. Suppression list ---------------------------------------------------------
insert into public.suppression_list (id, user_id, domain, reason) values ('99999999-0000-0000-0000-000000000001', :U1, 'mining.example', 'employer_request');
:AS_DISP
select tests.expect_error(
  $$update public.outbound_messages set status = 'sending' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  'suppression list');
:AS_USER1
delete from public.suppression_list where id = '99999999-0000-0000-0000-000000000001';

-- 8. Platform gate ------------------------------------------------------------
:AS_OPS
update public.platform_controls set external_comms_enabled = false where id = 1;
:AS_DISP
select tests.expect_error(
  $$update public.outbound_messages set status = 'sending' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  'not enabled for the platform');
:AS_OPS
update public.platform_controls set external_comms_enabled = true where id = 1;

-- 9. Happy path: send -------------------------------------------------------
:AS_DISP
update public.outbound_messages set status = 'sending' where id = 'eeeeeeee-0000-0000-0000-000000000001';
update public.outbound_messages set status = 'sent', provider_message_id = 'gmail-1' where id = 'eeeeeeee-0000-0000-0000-000000000001';
select tests.ok((select sent_at is not null from public.outbound_messages where id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'approved message passes every gate and is sent');
select tests.expect_error(
  $$update public.outbound_messages set body_text = 'rewrite history' where id = 'eeeeeeee-0000-0000-0000-000000000001'$$,
  'cannot edit a message');

-- 10. Anti-spam limits --------------------------------------------------------
:AS_AGENT
insert into public.outbound_messages (id, user_id, mail_account_id, employer_id, contact_id, category,
                                      to_addresses, subject, body_text, status, drafted_by)
values ('eeeeeeee-0000-0000-0000-000000000002', :U1, 'aaaaaaaa-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'initial_outreach',
        array['r2@mining.example'], 'Second cold email, same employer', 'Hi', 'pending_approval', 'agent'),
       ('eeeeeeee-0000-0000-0000-000000000003', :U1, 'aaaaaaaa-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000003', 'initial_outreach',
        array['r3@energy.example'], 'Cold email, second employer', 'Hi', 'pending_approval', 'agent');
:AS_USER1
insert into public.approvals (user_id, subject_type, subject_id, content_hash, decision, decided_by)
select :U1, 'outbound_message', id, content_hash, 'approved', :U1
  from public.outbound_messages where id in ('eeeeeeee-0000-0000-0000-000000000002','eeeeeeee-0000-0000-0000-000000000003');
update public.user_controls set max_initial_outreach_per_day = 5 where user_id = :U1;
:AS_DISP
select tests.expect_error(
  $$update public.outbound_messages set status = 'sending' where id = 'eeeeeeee-0000-0000-0000-000000000002'$$,
  'cold-contacted within');
:AS_USER1
update public.user_controls set max_initial_outreach_per_day = 1 where user_id = :U1;
:AS_DISP
select tests.expect_error(
  $$update public.outbound_messages set status = 'sending' where id = 'eeeeeeee-0000-0000-0000-000000000003'$$,
  'daily initial-outreach limit');

-- 11. Binding categories need explicit acknowledgement ------------------------
:AS_AGENT
insert into public.email_threads (id, user_id, mail_account_id, provider_thread_id, employer_id)
values ('12121212-0000-0000-0000-000000000001', :U1, 'aaaaaaaa-0000-0000-0000-000000000001', 't-1', 'cccccccc-0000-0000-0000-000000000002');
insert into public.outbound_messages (id, user_id, mail_account_id, thread_id, employer_id, category,
                                      to_addresses, subject, body_text, status, drafted_by)
values ('eeeeeeee-0000-0000-0000-000000000004', :U1, 'aaaaaaaa-0000-0000-0000-000000000001',
        '12121212-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002', 'offer_negotiation',
        array['r3@energy.example'], 'Re: offer', 'Could the base be $X?', 'pending_approval', 'agent');
:AS_USER1
select tests.expect_error(
  $$insert into public.approvals (user_id, subject_type, subject_id, content_hash, decision, decided_by)
    select '11111111-1111-1111-1111-111111111111','outbound_message', id, content_hash, 'approved','11111111-1111-1111-1111-111111111111'
      from public.outbound_messages where id = 'eeeeeeee-0000-0000-0000-000000000004'$$,
  'requires explicit acknowledgement');

-- 12. Offers and applications -------------------------------------------------
:AS_AGENT
insert into public.applications (id, user_id, employer_id) values ('13131313-0000-0000-0000-000000000001', :U1, 'cccccccc-0000-0000-0000-000000000002');
select tests.expect_error(
  $$update public.applications set status = 'submitted' where id = '13131313-0000-0000-0000-000000000001'$$,
  'only the user can set application status');
insert into public.offers (id, user_id, application_id, base_salary) values ('14141414-0000-0000-0000-000000000001', :U1, '13131313-0000-0000-0000-000000000001', 150000);
select tests.expect_error(
  $$update public.offers set status = 'accepted' where id = '14141414-0000-0000-0000-000000000001'$$,
  'only the user can set offer status');
:AS_USER1
update public.offers set status = 'accepted' where id = '14141414-0000-0000-0000-000000000001';
select tests.ok((select decided_at is not null from public.offers where id = '14141414-0000-0000-0000-000000000001'),
  'user can accept an offer themselves');

-- 13. Sponsorship evidence is never upgraded ---------------------------------
:AS_AGENT
insert into public.sponsorship_evidence (user_id, employer_id, evidence_type, visa_class, fiscal_year, filing_count,
                                         source_url, source_name, retrieved_at, created_by)
values (:U1, 'cccccccc-0000-0000-0000-000000000002', 'lca_disclosure', 'E-3 Australian', 2025, 4,
        'https://www.dol.gov/agencies/eta/foreign-labor/performance', 'DOL OFLC LCA disclosure FY2025', now(), 'agent');
select tests.ok((select sponsorship_signal = 'historical_sponsor_only' from public.v_employer_sponsorship
                  where employer_id = 'cccccccc-0000-0000-0000-000000000002'),
  'historical filings alone are labelled historical_sponsor_only, not willing');
select tests.expect_error(
  $$insert into public.sponsorship_evidence (user_id, employer_id, evidence_type, source_name, retrieved_at, created_by)
    values ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000002','written_confirmation','agent says so', now(),'agent')$$,
  'written_confirmation_needs_email');

-- 14. Inbound unsubscribe auto-suppresses ------------------------------------
insert into public.email_messages (user_id, thread_id, direction, provider_message_id, from_address, to_addresses,
                                   received_at, classification)
values (:U1, '12121212-0000-0000-0000-000000000001', 'inbound', 'in-1', 'R3@energy.example', array['u1@example.test'],
        now(), 'unsubscribe_request');
select tests.ok((select count(*) = 1 from public.suppression_list where email = 'r3@energy.example'),
  'unsubscribe request adds sender to suppression list');

-- 15. Pause stops agent task claims ------------------------------------------
:AS_USER1
insert into public.agent_tasks (id, user_id, agent, task_type) values ('15151515-0000-0000-0000-000000000001', :U1, 'employer_intelligence', 'discover');
:AS_USER1
update public.user_controls set agents_paused = true where user_id = :U1;
:AS_AGENT
select tests.ok((select count(*) = 0 from public.claim_agent_task('w1')), 'paused user: no task is claimed');
:AS_USER1
update public.user_controls set agents_paused = false where user_id = :U1;
:AS_AGENT
select tests.ok((select count(*) = 1 from public.claim_agent_task('w1')), 'resumed user: task is claimed');
:AS_USER1
select tests.expect_error($$select public.claim_agent_task('w1')$$, 'only agent workers|permission denied');

-- 16. Row-level isolation -----------------------------------------------------
:AS_USER2
select tests.ok((select count(*) = 0 from public.employers), 'user 2 cannot see user 1 employers');
select tests.ok((select count(*) = 0 from public.audit_log), 'user 2 cannot see user 1 audit log');
:AS_AGENT
select tests.expect_error($$select encrypted_refresh_token from public.mail_accounts$$, 'permission denied');
:AS_USER1
select tests.expect_error($$select encrypted_refresh_token from public.mail_accounts$$, 'permission denied');

-- 17. Audit log is append-only and tamper-evident ----------------------------
select tests.ok((select count(*) > 20 from public.audit_log), 'changes are audited');
select tests.ok((select bool_and(after_data ->> 'body_text' like 'sha256:%') from public.audit_log
                  where entity_type = 'outbound_messages' and after_data ? 'body_text'),
  'email bodies are hashed, not copied, into the audit log');
select tests.ok(public.fn_verify_audit_chain(:U1) is null, 'audit hash chain verifies');
select tests.expect_error($$delete from public.audit_log$$, 'append-only|permission denied');
:AS_ROOT
select tests.expect_error($$update public.audit_log set action = 'x'$$, 'append-only');
alter table public.audit_log disable trigger audit_log_no_update;
update public.audit_log set action = 'tampered' where id = (select min(id) + 3 from public.audit_log where user_id = :U1);
alter table public.audit_log enable trigger audit_log_no_update;
:AS_USER1
select tests.ok(public.fn_verify_audit_chain(:U1) is not null, 'tampering with the audit log is detected');

:AS_ROOT
\o
\echo 'ALL SAFEGUARD TESTS PASSED'
