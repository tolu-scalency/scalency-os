-- Scalency OS: a one-step way to set up an account (a business) for the app.
-- The plain-English guide is docs/database.md ("Setting up an account").
--
-- setup_account() creates the account, makes an existing login its owner, and adds the
-- lead-gen pipeline with the 10 stages decided on 3 November 2026 (docs/plans/automation-engine.md).
-- It's run by hand in the Supabase SQL editor. The app and the public can't call it.

create function public.setup_account(account_name text, account_slug text, owner_email text, sms_test_phone text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  new_account uuid;
  new_pipeline uuid;
  stage_name text;
  stage_position integer := 0;
begin
  -- The owner must have been invited first (Authentication > Users in Supabase).
  select id into owner_id from auth.users where lower(email) = lower(owner_email);
  if owner_id is null then
    raise exception 'No login found for %. Invite them in Authentication > Users first.', owner_email;
  end if;

  insert into public.accounts (name, slug, test_mode, test_email, test_phone)
  values (account_name, account_slug, true, owner_email, sms_test_phone)
  returning id into new_account;

  insert into public.account_members (account_id, user_id, role)
  values (new_account, owner_id, 'owner');

  insert into public.pipelines (account_id, name)
  values (new_account, 'Lead gen')
  returning id into new_pipeline;

  foreach stage_name in array array[
    'Application Started', 'Qualified, Not Booked', 'Call Booked', 'Confirmed', 'No Answer',
    'No-Show', 'Unqualified', 'Follow-Up', 'Closed', 'Lost'
  ] loop
    stage_position := stage_position + 1;
    insert into public.pipeline_stages (account_id, pipeline_id, name, position)
    values (new_account, new_pipeline, stage_name, stage_position);
  end loop;

  return new_account;
end;
$$;

-- Only the database owner (the SQL editor) can run it.
revoke execute on function public.setup_account(text, text, text, text) from public, anon, authenticated;

-- Adds another existing login to an account, e.g. George or an engineer.
create function public.add_account_member(account_slug text, member_email text, member_role text default 'member')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
  target uuid;
begin
  select id into member_id from auth.users where lower(email) = lower(member_email);
  if member_id is null then
    raise exception 'No login found for %. Invite them in Authentication > Users first.', member_email;
  end if;
  select id into target from public.accounts where slug = account_slug;
  if target is null then
    raise exception 'No account with the slug %.', account_slug;
  end if;
  insert into public.account_members (account_id, user_id, role)
  values (target, member_id, member_role)
  on conflict (account_id, user_id) do update set role = excluded.role;
end;
$$;

revoke execute on function public.add_account_member(text, text, text) from public, anon, authenticated;
