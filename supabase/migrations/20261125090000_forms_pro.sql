-- Forms: views and conversion, file uploads and signatures, and team alerts.
-- Safe to run more than once.
--
-- * form_stats: page views per form per day, so the Forms page can show views
--   and conversion. Counted by the app's server (service key) only.
-- * form_uploads: files and signatures people attach to a form. The files sit
--   in the private storage bucket "form-uploads"; the app hands out short-lived
--   links to team members who can see that workspace.
-- * form_post_to_chat: posts a "new submission" alert in the workspace's
--   #leads team chat. Called by the app's server only.

-- ---------------------------------------------------------------- views
create table if not exists public.form_stats (
  form_id uuid not null,
  account_id uuid not null references public.accounts (id) on delete cascade,
  day date not null default current_date,
  views integer not null default 0,
  primary key (form_id, day),
  foreign key (form_id, account_id) references public.forms (id, account_id) on delete cascade
);
create index if not exists form_stats_account_idx on public.form_stats (account_id, day desc);
alter table public.form_stats enable row level security;
drop policy if exists "Members read form stats" on public.form_stats;
create policy "Members read form stats" on public.form_stats for select to authenticated
  using (public.is_account_member(account_id));
revoke all on public.form_stats from anon;
grant select on public.form_stats to authenticated;

create or replace function public.count_form_view(target_form uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.form_stats (form_id, account_id, day, views)
  select f.id, f.account_id, current_date, 1 from public.forms f where f.id = target_form and f.status = 'live'
  on conflict (form_id, day) do update set views = public.form_stats.views + 1;
$$;
revoke execute on function public.count_form_view(uuid) from public, anon, authenticated;
grant execute on function public.count_form_view(uuid) to service_role;

-- ---------------------------------------------------------------- uploads
create table if not exists public.form_uploads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  form_id uuid not null,
  path text not null,
  name text not null,
  size integer not null check (size > 0),
  content_type text not null,
  who text not null default '',
  created_at timestamptz not null default now(),
  foreign key (form_id, account_id) references public.forms (id, account_id) on delete cascade
);
create index if not exists form_uploads_form_idx on public.form_uploads (form_id, who, created_at desc);
alter table public.form_uploads enable row level security;
drop policy if exists "Members read form uploads" on public.form_uploads;
create policy "Members read form uploads" on public.form_uploads for select to authenticated
  using (public.is_account_member(account_id));
revoke all on public.form_uploads from anon;
grant select on public.form_uploads to authenticated;

-- The private bucket (only on Supabase, where the storage schema exists).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('form-uploads', 'form-uploads', false, 4194304)
    on conflict (id) do update set public = false, file_size_limit = 4194304;
  end if;
end $$;

-- ---------------------------------------------------------------- team chat alert
create or replace function public.form_post_to_chat(target_account uuid, target_contact uuid, message text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_messages (account_id, channel_id, author_id, body, contact_id)
  values (target_account, public.chat_channel_for(target_account, 'leads'), null, left(message, 4000), target_contact);
end;
$$;
revoke execute on function public.form_post_to_chat(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.form_post_to_chat(uuid, uuid, text) to service_role;
