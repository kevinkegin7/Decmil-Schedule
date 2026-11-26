-- =============================================================================
-- LOCAL DEVELOPMENT SEED ONLY — runs on `supabase db reset` / `supabase start`.
-- Never run against the production project.
--
-- Creates a local login for the project owner and loads the starter profile
-- (the facts the owner supplied, all flagged for review, all unverified).
--
--   email:    owner@hseq.local
--   password: LocalDevOnly-2026   (local stack only; sign-up is disabled)
--
-- In production, sign in with the real account and press
-- "Load starter profile" on the dashboard; it calls the same function.
-- =============================================================================

do $$
declare
  v_uid uuid := '0b0e0000-0000-4000-8000-000000000001';
  v_email text := 'owner@hseq.local';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token)
  values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    extensions.crypt('LocalDevOnly-2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid, v_uid::text,
          jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now())
  on conflict do nothing;

  -- Act as the owner so the loader runs exactly as it does from the dashboard.
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'role', 'authenticated')::text, true);
  perform public.load_starter_profile();
  update public.profiles set full_name = 'Kevin' where id = v_uid and full_name is null;
end $$;
