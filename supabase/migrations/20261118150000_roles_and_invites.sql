-- Roles, permissions and invite links.
--
-- 1. Each workspace can have roles (e.g. "Sales rep") with a set of permissions.
--    Owners and admins can do everything. Members get the permissions of their
--    role. Members with no role keep what members could always do.
-- 2. The database enforces the permissions itself (restrictive policies), so
--    hiding a button is never the only protection.
-- 3. Invites carry a private link token and an expiry. The invite link opens a
--    page where new people choose a password and existing people log in, and
--    either way they land straight in the workspace that invited them.

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

create or replace function public.all_permissions() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'contacts.view_all',  -- see every contact (otherwise only the ones they own)
    'contacts.edit',      -- add and edit contacts, tags, notes and field values
    'contacts.delete',    -- delete contacts
    'deals.edit',         -- add, move and update deals
    'pipeline.manage',    -- add, rename and remove pipelines and stages
    'inbox.send',         -- send emails and texts
    'workflows.manage',   -- create, edit, switch on and off workflows
    'settings.manage',    -- custom fields, values, tags, sending, AI setup, workspace details
    'team.manage'         -- invite and remove people, change roles
  ]::text[];
$$;

-- What members with no role can do (what members could always do).
create or replace function public.default_member_permissions() returns text[]
language sql immutable set search_path = '' as $$
  select array['contacts.view_all', 'contacts.edit', 'contacts.delete', 'deals.edit', 'pipeline.manage', 'inbox.send', 'workflows.manage']::text[];
$$;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

create table public.account_roles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  description text check (char_length(description) <= 200),
  permissions text[] not null default '{}' check (permissions <@ public.all_permissions()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index account_roles_name_key on public.account_roles (account_id, lower(name));
create trigger set_updated_at before update on public.account_roles for each row execute function public.set_updated_at();

alter table public.account_members add column role_id uuid references public.account_roles on delete set null;
alter table public.account_invites add column role_id uuid references public.account_roles on delete set null;

-- The permissions the signed-in person has in a workspace.
create or replace function public.my_permissions(target uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select case
    when m.role in ('owner', 'admin') then public.all_permissions()
    when m.role_id is not null then coalesce(r.permissions, '{}')
    else public.default_member_permissions()
  end
  from public.account_members m
  left join public.account_roles r on r.id = m.role_id
  where m.account_id = target and m.user_id = (select auth.uid());
$$;

create or replace function public.has_permission(target uuid, perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(perm = any(public.my_permissions(target)), false);
$$;

-- Every workspace where the signed-in person has a permission. Used in policies
-- as "account_id in (select ...)" so it runs once per query, not once per row.
create or replace function public.accounts_where_i_can(perm text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.account_id
  from public.account_members m
  left join public.account_roles r on r.id = m.role_id
  where m.user_id = (select auth.uid())
    and (
      m.role in ('owner', 'admin')
      or (m.role_id is not null and perm = any(coalesce(r.permissions, '{}')))
      or (m.role_id is null and perm = any(public.default_member_permissions()))
    );
$$;

revoke execute on function public.my_permissions(uuid) from public, anon;
revoke execute on function public.has_permission(uuid, text) from public, anon;
revoke execute on function public.accounts_where_i_can(text) from public, anon;
grant execute on function public.my_permissions(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.accounts_where_i_can(text) to authenticated;

alter table public.account_roles enable row level security;
create policy "Members see their accounts' roles" on public.account_roles for select to authenticated
  using (public.is_account_member(account_id));
create policy "Team managers manage roles" on public.account_roles for all to authenticated
  using (account_id in (select public.accounts_where_i_can('team.manage')))
  with check (account_id in (select public.accounts_where_i_can('team.manage')));
revoke all on public.account_roles from anon;
grant select, insert, update, delete on public.account_roles to authenticated;

-- Starter roles for every workspace, new and existing.
create or replace function public.add_starter_roles(target uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.account_roles (account_id, name, description, permissions) values
    (target, 'Team member', 'Works on every contact and deal, but can''t change settings or the team.',
      array['contacts.view_all', 'contacts.edit', 'contacts.delete', 'deals.edit', 'pipeline.manage', 'inbox.send', 'workflows.manage']),
    (target, 'Sales rep', 'Sees only the contacts they own. Can add contacts, move deals and send messages.',
      array['contacts.edit', 'deals.edit', 'inbox.send']),
    (target, 'Viewer', 'Can look at every contact and deal but can''t change anything.',
      array['contacts.view_all'])
  on conflict do nothing;
$$;
revoke execute on function public.add_starter_roles(uuid) from public, anon, authenticated;

create or replace function public.on_account_created_roles() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.add_starter_roles(new.id);
  return null;
end;
$$;
create trigger accounts_starter_roles after insert on public.accounts
  for each row execute function public.on_account_created_roles();

select public.add_starter_roles(id) from public.accounts;

-- ---------------------------------------------------------------------------
-- Enforcement. Restrictive policies are added on top of "members manage their
-- accounts' records", so a row must pass both.
-- ---------------------------------------------------------------------------

-- Contacts: people without "see all" only see the contacts they own.
create policy "Contacts: view" on public.contacts as restrictive for select to authenticated
  using (account_id in (select public.accounts_where_i_can('contacts.view_all')) or owner_id = (select auth.uid()));
create policy "Contacts: add" on public.contacts as restrictive for insert to authenticated
  with check (account_id in (select public.accounts_where_i_can('contacts.edit')));
create policy "Contacts: edit" on public.contacts as restrictive for update to authenticated
  using (account_id in (select public.accounts_where_i_can('contacts.edit'))
         and (account_id in (select public.accounts_where_i_can('contacts.view_all')) or owner_id = (select auth.uid())))
  with check (account_id in (select public.accounts_where_i_can('contacts.edit')));
create policy "Contacts: delete" on public.contacts as restrictive for delete to authenticated
  using (account_id in (select public.accounts_where_i_can('contacts.delete')));

-- New contacts made by someone who can only see their own are owned by them,
-- so they don't disappear the moment they're saved.
create or replace function public.own_new_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is null and (select auth.uid()) is not null
     and not public.has_permission(new.account_id, 'contacts.view_all') then
    new.owner_id := (select auth.uid());
  end if;
  return new;
end;
$$;
create trigger contacts_own_new before insert on public.contacts
  for each row execute function public.own_new_contact();

-- Things that belong to a contact follow the contact's visibility.
create or replace function public.can_see_contact(target_account uuid, target_contact uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select target_contact is null
    or public.has_permission(target_account, 'contacts.view_all')
    or exists (select 1 from public.contacts c where c.id = target_contact and c.owner_id = (select auth.uid()));
$$;
revoke execute on function public.can_see_contact(uuid, uuid) from public, anon;
grant execute on function public.can_see_contact(uuid, uuid) to authenticated;

create policy "Deals: view" on public.opportunities as restrictive for select to authenticated
  using (account_id in (select public.accounts_where_i_can('contacts.view_all'))
         or assigned_to = (select auth.uid())
         or public.can_see_contact(account_id, contact_id));
create policy "Deals: add" on public.opportunities as restrictive for insert to authenticated
  with check (account_id in (select public.accounts_where_i_can('deals.edit')));
create policy "Deals: edit" on public.opportunities as restrictive for update to authenticated
  using (account_id in (select public.accounts_where_i_can('deals.edit')));
create policy "Deals: delete" on public.opportunities as restrictive for delete to authenticated
  using (account_id in (select public.accounts_where_i_can('deals.edit')));

create policy "Messages: view" on public.messages as restrictive for select to authenticated
  using (account_id in (select public.accounts_where_i_can('contacts.view_all')) or public.can_see_contact(account_id, contact_id));
create policy "Messages: send" on public.messages as restrictive for insert to authenticated
  with check (account_id in (select public.accounts_where_i_can('inbox.send')));

create policy "Activity: view" on public.activity as restrictive for select to authenticated
  using (account_id in (select public.accounts_where_i_can('contacts.view_all')) or public.can_see_contact(account_id, contact_id));

create policy "Contact tags: change" on public.contact_tags as restrictive for insert to authenticated
  with check (account_id in (select public.accounts_where_i_can('contacts.edit')));
create policy "Contact tags: remove" on public.contact_tags as restrictive for delete to authenticated
  using (account_id in (select public.accounts_where_i_can('contacts.edit')));

-- Tags: anyone who edits contacts can create a tag; only settings managers rename or delete them.
create policy "Tags: add" on public.tags as restrictive for insert to authenticated
  with check (account_id in (select public.accounts_where_i_can('contacts.edit'))
              or account_id in (select public.accounts_where_i_can('settings.manage')));
create policy "Tags: edit" on public.tags as restrictive for update to authenticated
  using (account_id in (select public.accounts_where_i_can('settings.manage')));
create policy "Tags: delete" on public.tags as restrictive for delete to authenticated
  using (account_id in (select public.accounts_where_i_can('settings.manage')));

-- Pipelines and stages.
do $$
declare
  t text;
  op text;
begin
  foreach t in array array['pipelines', 'pipeline_stages'] loop
    foreach op in array array['insert', 'update', 'delete'] loop
      execute format(
        'create policy %I on public.%I as restrictive for %s to authenticated %s',
        'Pipeline: ' || op, t, op,
        case when op = 'insert' then 'with check (account_id in (select public.accounts_where_i_can(''pipeline.manage'')))'
             else 'using (account_id in (select public.accounts_where_i_can(''pipeline.manage'')))' end);
    end loop;
  end loop;

  foreach op in array array['insert', 'update', 'delete'] loop
    execute format(
      'create policy %I on public.workflows as restrictive for %s to authenticated %s',
      'Workflows: ' || op, op,
      case when op = 'insert' then 'with check (account_id in (select public.accounts_where_i_can(''workflows.manage'')))'
           else 'using (account_id in (select public.accounts_where_i_can(''workflows.manage'')))' end);
  end loop;

  foreach t in array array['custom_fields', 'custom_values', 'message_templates', 'forms', 'outbound_webhooks'] loop
    foreach op in array array['insert', 'update', 'delete'] loop
      execute format(
        'create policy %I on public.%I as restrictive for %s to authenticated %s',
        'Settings: ' || op, t, op,
        case when op = 'insert' then 'with check (account_id in (select public.accounts_where_i_can(''settings.manage'')))'
             else 'using (account_id in (select public.accounts_where_i_can(''settings.manage'')))' end);
    end loop;
  end loop;
end;
$$;

create policy "Workspace details" on public.accounts as restrictive for update to authenticated
  using (id in (select public.accounts_where_i_can('settings.manage')));

create policy "Invites: send" on public.account_invites as restrictive for insert to authenticated
  with check (account_id in (select public.accounts_where_i_can('team.manage')));
create policy "Invites: cancel" on public.account_invites as restrictive for delete to authenticated
  using (account_id in (select public.accounts_where_i_can('team.manage')));

-- AI setup and anything else that asked "owner or admin" now asks for settings.manage.
create or replace function public.can_manage_account(target_account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_permission(target_account, 'settings.manage');
$$;

-- Changing someone's access. Owners can't be changed here.
create or replace function public.set_member_access(target_account uuid, member uuid, new_role text, new_role_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_role_name text;
begin
  if not public.has_permission(target_account, 'team.manage') then
    raise exception 'Only people who manage the team can change access.';
  end if;
  select role into current_role_name from public.account_members where account_id = target_account and user_id = member;
  if current_role_name is null then
    raise exception 'That person isn''t in this workspace.';
  end if;
  if current_role_name = 'owner' then
    raise exception 'The owner''s access can''t be changed.';
  end if;
  if new_role not in ('admin', 'member') then
    raise exception 'Choose admin or a role.';
  end if;
  if new_role_id is not null and not exists (select 1 from public.account_roles where id = new_role_id and account_id = target_account) then
    raise exception 'That role doesn''t exist.';
  end if;
  update public.account_members
  set role = new_role, role_id = case when new_role = 'admin' then null else new_role_id end
  where account_id = target_account and user_id = member;
end;
$$;
revoke execute on function public.set_member_access(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.set_member_access(uuid, uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invite links
-- ---------------------------------------------------------------------------

alter table public.account_invites
  add column token text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  add column expires_at timestamptz not null default now() + interval '7 days';
create unique index account_invites_token_key on public.account_invites (token);

-- What the invite page shows. Anyone holding the link can see it.
create or replace function public.invite_details(invite_token text)
returns table (email text, workspace text, invited_by text, access text, status text, has_login boolean)
language sql stable security definer set search_path = '' as $$
  select
    i.email,
    a.name,
    coalesce(p.full_name, u.email),
    case when i.role = 'admin' then 'Admin' else coalesce(r.name, 'Team member') end,
    case when i.accepted_at is not null then 'used' when i.expires_at < now() then 'expired' else 'open' end,
    exists (select 1 from auth.users x where lower(x.email) = lower(i.email))
  from public.account_invites i
  join public.accounts a on a.id = i.account_id
  left join public.account_roles r on r.id = i.role_id
  left join auth.users u on u.id = i.invited_by
  left join public.profiles p on p.user_id = i.invited_by
  where i.token = invite_token and char_length(invite_token) >= 32;
$$;
revoke execute on function public.invite_details(text) from public;
grant execute on function public.invite_details(text) to anon, authenticated;

-- Joins the signed-in person to the workspace in the invite link.
create or replace function public.accept_invite_token(invite_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  invite record;
begin
  select i.* into invite from public.account_invites i where i.token = invite_token;
  if invite.id is null then
    raise exception 'This invite link isn''t valid.';
  end if;
  if invite.accepted_at is not null then
    if exists (select 1 from public.account_members where account_id = invite.account_id and user_id = me) then
      return invite.account_id;
    end if;
    raise exception 'This invite has already been used.';
  end if;
  if invite.expires_at < now() then
    raise exception 'This invite has expired. Ask for a new one.';
  end if;
  if lower(invite.email) <> (select lower(email) from auth.users where id = me) then
    raise exception 'This invite was sent to a different email address.';
  end if;
  insert into public.account_members (account_id, user_id, role, role_id)
  values (invite.account_id, me, invite.role, case when invite.role = 'admin' then null else invite.role_id end)
  on conflict (account_id, user_id) do nothing;
  update public.account_invites set accepted_at = now() where id = invite.id;
  return invite.account_id;
end;
$$;
revoke execute on function public.accept_invite_token(text) from public, anon;
grant execute on function public.accept_invite_token(text) to authenticated;

-- The older join paths (workspace menu "Join", and joining on first sign-in) now copy the role too and respect expiry.
create or replace function public.accept_invite(target_invite uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  invite record;
begin
  select i.* into invite from public.account_invites i
  where i.id = target_invite and i.accepted_at is null and i.expires_at >= now()
    and lower(i.email) = (select lower(email) from auth.users where id = me);
  if invite.id is null then
    raise exception 'That invite is no longer available.';
  end if;
  insert into public.account_members (account_id, user_id, role, role_id)
  values (invite.account_id, me, invite.role, case when invite.role = 'admin' then null else invite.role_id end)
  on conflict (account_id, user_id) do nothing;
  update public.account_invites set accepted_at = now() where id = invite.id;
  return invite.account_id;
end;
$$;

create or replace function public.accept_my_invites() returns uuid
language plpgsql security definer set search_path = '' as $$
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
    select id, account_id, role, role_id from public.account_invites
    where lower(email) = my_email and accepted_at is null and expires_at >= now()
    order by created_at
  loop
    insert into public.account_members (account_id, user_id, role, role_id)
    values (invite.account_id, me, invite.role, case when invite.role = 'admin' then null else invite.role_id end)
    on conflict (account_id, user_id) do nothing;
    update public.account_invites set accepted_at = now() where id = invite.id;
    first_account := coalesce(first_account, invite.account_id);
  end loop;
  return first_account;
end;
$$;

create or replace function public.my_pending_invites()
returns table (invite_id uuid, account_name text, role text, invited_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, a.name, i.role, i.created_at
  from public.account_invites i
  join public.accounts a on a.id = i.account_id
  where i.accepted_at is null and i.expires_at >= now()
    and lower(i.email) = (select lower(email) from auth.users where id = (select auth.uid()))
  order by i.created_at desc;
$$;

-- "Send again" gives the invite another 7 days. The link stays the same, so earlier emails keep working.
create or replace function public.refresh_invite(target_invite uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  t text;
begin
  update public.account_invites i set expires_at = now() + interval '7 days'
  where i.id = target_invite and i.accepted_at is null
    and i.account_id in (select public.accounts_where_i_can('team.manage'))
  returning i.token into t;
  if t is null then
    raise exception 'That invite no longer exists.';
  end if;
  return t;
end;
$$;
revoke execute on function public.refresh_invite(uuid) from public, anon;
grant execute on function public.refresh_invite(uuid) to authenticated;
