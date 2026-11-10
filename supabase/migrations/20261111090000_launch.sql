-- Scalency OS: what the app needs for its public launch.
-- The plain-English guide is docs/database.md ("Launch").
--
-- 1. New workspaces start empty: the owner builds their own pipeline in the app.
-- 2. Tasks: simple to-dos, optionally linked to a contact.
-- 3. Team invites: an owner adds an email; when that person signs up they join the workspace.
-- 4. Teammates can see each other's names, and owners can remove members.

-- ---------------------------------------------------------------------------
-- 1. Workspaces start empty
-- ---------------------------------------------------------------------------

create or replace function public.create_my_workspace(business_name text, details jsonb default '{}')
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
  base_slug text;
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

  return new_account;
end;
$$;

revoke execute on function public.create_my_workspace(text, jsonb) from public, anon;
grant execute on function public.create_my_workspace(text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  due_on date,
  contact_id uuid,
  assigned_to uuid references auth.users on delete set null,
  created_by uuid references auth.users on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id, account_id) references public.contacts (id, account_id) on delete cascade
);
create index tasks_account_open_idx on public.tasks (account_id, done_at, due_on);
create index tasks_contact_idx on public.tasks (contact_id);

create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
create policy "Members manage their accounts' records" on public.tasks for all to authenticated
  using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Team invites
-- ---------------------------------------------------------------------------

create table public.account_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid references auth.users on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index account_invites_open_key on public.account_invites (account_id, lower(email)) where accepted_at is null;

alter table public.account_invites enable row level security;
create policy "Members see their accounts' invites" on public.account_invites for select to authenticated
  using (public.is_account_member(account_id));
create policy "Members invite to their accounts" on public.account_invites for insert to authenticated
  with check (public.is_account_member(account_id) and invited_by = (select auth.uid()) and accepted_at is null);
create policy "Members cancel their accounts' invites" on public.account_invites for delete to authenticated
  using (public.is_account_member(account_id) and accepted_at is null);
revoke all on public.account_invites from anon;
grant select, insert, delete on public.account_invites to authenticated;

-- Joins the signed-in person to every workspace that invited their email. Returns the first one, or null.
create function public.accept_my_invites()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_email text;
  invite record;
  first_account uuid;
begin
  if me is null then
    return null;
  end if;
  select lower(email) into my_email from auth.users where id = me;
  if my_email is null then
    return null;
  end if;

  for invite in
    select id, account_id, role from public.account_invites
    where lower(email) = my_email and accepted_at is null
    order by created_at
  loop
    insert into public.account_members (account_id, user_id, role)
    values (invite.account_id, me, invite.role)
    on conflict (account_id, user_id) do nothing;
    update public.account_invites set accepted_at = now() where id = invite.id;
    first_account := coalesce(first_account, invite.account_id);
  end loop;

  return first_account;
end;
$$;

revoke execute on function public.accept_my_invites() from public, anon;
grant execute on function public.accept_my_invites() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Teammates and member removal
-- ---------------------------------------------------------------------------

alter table public.profiles add column email text;

-- True when the signed-in person shares a workspace with this login.
create function public.is_teammate(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.account_members mine
    join public.account_members theirs on theirs.account_id = mine.account_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = other
  );
$$;
revoke execute on function public.is_teammate(uuid) from public, anon;
grant execute on function public.is_teammate(uuid) to authenticated;

create policy "Teammates see each other's profiles" on public.profiles for select to authenticated
  using (public.is_teammate(user_id));

-- Owners can remove someone from their workspace (not themselves).
create function public.remove_account_member(target_account uuid, member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.account_members
    where account_id = target_account and user_id = (select auth.uid()) and role = 'owner'
  ) then
    raise exception 'Only the workspace owner can remove members.';
  end if;
  if member = (select auth.uid()) then
    raise exception 'You can''t remove yourself.';
  end if;
  delete from public.account_members where account_id = target_account and user_id = member;
end;
$$;
revoke execute on function public.remove_account_member(uuid, uuid) from public, anon;
grant execute on function public.remove_account_member(uuid, uuid) to authenticated;
