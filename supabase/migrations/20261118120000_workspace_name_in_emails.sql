-- Workspace names in sign-in emails.
--
-- Supabase's auth emails can read the user's metadata. We keep
-- `workspace_name` there up to date (the first workspace they joined), so the
-- sign-in, password and code emails say "Sign in to Maximus HQ" instead of
-- "Sign in to Scalency OS".

create or replace function public.sync_workspace_name(target_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ws text;
begin
  select a.name into ws
  from public.account_members m
  join public.accounts a on a.id = m.account_id
  where m.user_id = target_user
  order by m.created_at, a.created_at
  limit 1;

  update auth.users
  set raw_user_meta_data = case
    when ws is null then coalesce(raw_user_meta_data, '{}'::jsonb) - 'workspace_name'
    else coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('workspace_name', ws)
  end
  where id = target_user
    and (raw_user_meta_data ->> 'workspace_name') is distinct from ws;
end;
$$;
revoke execute on function public.sync_workspace_name(uuid) from public, anon, authenticated;

create or replace function public.on_membership_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.sync_workspace_name(coalesce(new.user_id, old.user_id));
  return null;
end;
$$;

drop trigger if exists account_members_workspace_name on public.account_members;
create trigger account_members_workspace_name after insert or delete on public.account_members
  for each row execute function public.on_membership_change();

create or replace function public.on_account_renamed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  u uuid;
begin
  for u in select user_id from public.account_members where account_id = new.id loop
    perform public.sync_workspace_name(u);
  end loop;
  return null;
end;
$$;

drop trigger if exists accounts_workspace_name on public.accounts;
create trigger accounts_workspace_name after update of name on public.accounts
  for each row when (old.name is distinct from new.name)
  execute function public.on_account_renamed();

-- Fill it in for everyone who already has a workspace.
select public.sync_workspace_name(user_id) from (select distinct user_id from public.account_members) m;
