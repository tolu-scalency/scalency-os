-- Custom access per person: tick exactly what someone can do, on top of (or
-- instead of) a role. When a member has their own permission list, it wins.

create or replace function public.all_permissions() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'contacts.view_all', 'contacts.edit', 'contacts.delete', 'contacts.import', 'contacts.export',
    'deals.edit', 'pipeline.manage',
    'inbox.send', 'calls.make',
    'workflows.manage',
    'calendars.manage', 'payments.manage', 'marketing.manage', 'sites.manage', 'ai.manage', 'reporting.view',
    'settings.manage', 'team.manage'
  ]::text[];
$$;

alter table public.account_members add column permissions text[] check (permissions is null or permissions <@ public.all_permissions());
alter table public.account_invites add column permissions text[] check (permissions is null or permissions <@ public.all_permissions());

create or replace function public.my_permissions(target uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select case
    when m.role in ('owner', 'admin') then public.all_permissions()
    when m.permissions is not null then m.permissions
    when m.role_id is not null then coalesce(r.permissions, '{}')
    else public.default_member_permissions()
  end
  from public.account_members m
  left join public.account_roles r on r.id = m.role_id
  where m.account_id = target and m.user_id = (select auth.uid());
$$;

create or replace function public.accounts_where_i_can(perm text) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.account_id
  from public.account_members m
  left join public.account_roles r on r.id = m.role_id
  where m.user_id = (select auth.uid())
    and (
      m.role in ('owner', 'admin')
      or (m.permissions is not null and perm = any(m.permissions))
      or (m.permissions is null and m.role_id is not null and perm = any(coalesce(r.permissions, '{}')))
      or (m.permissions is null and m.role_id is null and perm = any(public.default_member_permissions()))
    );
$$;

-- Sets someone's exact access. A role (optional) is kept as the starting point and label.
create or replace function public.set_member_permissions(target_account uuid, member uuid, base_role uuid, new_permissions text[])
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
  if not (coalesce(new_permissions, '{}') <@ public.all_permissions()) then
    raise exception 'Unknown permission.';
  end if;
  if base_role is not null and not exists (select 1 from public.account_roles where id = base_role and account_id = target_account) then
    raise exception 'That role doesn''t exist.';
  end if;
  update public.account_members
  set role = 'member', role_id = base_role, permissions = coalesce(new_permissions, '{}')
  where account_id = target_account and user_id = member;
end;
$$;
revoke execute on function public.set_member_permissions(uuid, uuid, uuid, text[]) from public, anon;
grant execute on function public.set_member_permissions(uuid, uuid, uuid, text[]) to authenticated;

-- Choosing a role (or Admin) again clears any custom list.
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
  set role = new_role, role_id = case when new_role = 'admin' then null else new_role_id end, permissions = null
  where account_id = target_account and user_id = member;
end;
$$;

-- Joining copies the invite's custom access too.
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
  insert into public.account_members (account_id, user_id, role, role_id, permissions)
  values (invite.account_id, me, invite.role,
          case when invite.role = 'admin' then null else invite.role_id end,
          case when invite.role = 'admin' then null else invite.permissions end)
  on conflict (account_id, user_id) do nothing;
  update public.account_invites set accepted_at = now() where id = invite.id;
  return invite.account_id;
end;
$$;

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
  insert into public.account_members (account_id, user_id, role, role_id, permissions)
  values (invite.account_id, me, invite.role,
          case when invite.role = 'admin' then null else invite.role_id end,
          case when invite.role = 'admin' then null else invite.permissions end)
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
    select id, account_id, role, role_id, permissions from public.account_invites
    where lower(email) = my_email and accepted_at is null and expires_at >= now()
    order by created_at
  loop
    insert into public.account_members (account_id, user_id, role, role_id, permissions)
    values (invite.account_id, me, invite.role,
            case when invite.role = 'admin' then null else invite.role_id end,
            case when invite.role = 'admin' then null else invite.permissions end)
    on conflict (account_id, user_id) do nothing;
    update public.account_invites set accepted_at = now() where id = invite.id;
    first_account := coalesce(first_account, invite.account_id);
  end loop;
  return first_account;
end;
$$;

-- The invite page says "Custom access" when the invite has its own list.
create or replace function public.invite_details(invite_token text)
returns table (email text, workspace text, invited_by text, access text, status text, has_login boolean)
language sql stable security definer set search_path = '' as $$
  select
    i.email,
    a.name,
    coalesce(p.full_name, u.email),
    case when i.role = 'admin' then 'Admin' when i.permissions is not null then 'Custom access' else coalesce(r.name, 'Team member') end,
    case when i.accepted_at is not null then 'used' when i.expires_at < now() then 'expired' else 'open' end,
    exists (select 1 from auth.users x where lower(x.email) = lower(i.email))
  from public.account_invites i
  join public.accounts a on a.id = i.account_id
  left join public.account_roles r on r.id = i.role_id
  left join auth.users u on u.id = i.invited_by
  left join public.profiles p on p.user_id = i.invited_by
  where i.token = invite_token and char_length(invite_token) >= 32;
$$;
