-- Scalency OS: public sign-up and onboarding.
-- The plain-English guide is docs/database.md ("Sign-up and onboarding").
--
-- Anyone can create a login at os.scalency.us/signup. They then answer three short steps
-- (about you, your business, your goals) and create_my_workspace() sets up their own account:
-- they become its owner and get the lead-gen pipeline with its 10 stages. Every new account
-- starts in test mode, and row-level security keeps each business to its own data.

-- What the business told us during onboarding: website, industry, team size, goals and so on.
alter table public.accounts add column onboarding jsonb not null default '{}'
  check (jsonb_typeof(onboarding) = 'object' and pg_column_size(onboarding) < 8000);

-- One row per login: the person's own details.
create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  job_title text check (job_title is null or length(job_title) <= 80),
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "People see their own profile" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "People add their own profile" on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "People edit their own profile" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- Creates a workspace for the signed-in person, with them as owner. If they already own one,
-- it returns that one instead of making a second.
create function public.create_my_workspace(business_name text, details jsonb default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_email text;
  existing uuid;
  new_account uuid;
  new_pipeline uuid;
  base_slug text;
  stage_name text;
  stage_position integer := 0;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;

  select account_id into existing from public.account_members
  where user_id = me and role = 'owner' order by created_at limit 1;
  if existing is not null then
    return existing;
  end if;

  business_name := trim(coalesce(business_name, ''));
  if length(business_name) < 2 or length(business_name) > 80 then
    raise exception 'The business name must be 2 to 80 characters.';
  end if;
  if details is null or jsonb_typeof(details) <> 'object' then
    details := '{}';
  end if;

  select email into my_email from auth.users where id = me;

  -- A readable, unique web-safe name, e.g. "bright-clinic-3f9a2c".
  base_slug := trim(both '-' from regexp_replace(lower(business_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'workspace';
  end if;
  base_slug := trim(both '-' from left(base_slug, 40)) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);

  insert into public.accounts (name, slug, test_mode, test_email, onboarding)
  values (business_name, base_slug, true, my_email, details)
  returning id into new_account;

  insert into public.account_members (account_id, user_id, role)
  values (new_account, me, 'owner');

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

revoke execute on function public.create_my_workspace(text, jsonb) from public, anon;
grant execute on function public.create_my_workspace(text, jsonb) to authenticated;
