-- SQL-25: calendars like GHL. Calendar groups, a meeting location per team member,
-- and more meeting places (Zoom, ask the booker).

-- 1. Groups -----------------------------------------------------------------------------------
create table if not exists public.calendar_groups (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name text not null check (length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (id, account_id)
);
create index if not exists calendar_groups_account_idx on public.calendar_groups (account_id);
alter table public.calendar_groups enable row level security;

drop policy if exists "Calendar groups: read" on public.calendar_groups;
create policy "Calendar groups: read" on public.calendar_groups for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Calendar groups: manage" on public.calendar_groups;
create policy "Calendar groups: manage" on public.calendar_groups for all to authenticated
  using (account_id in (select public.accounts_where_i_can('calendars.manage')))
  with check (account_id in (select public.accounts_where_i_can('calendars.manage')));
grant select, insert, update, delete on public.calendar_groups to authenticated;
grant select, insert, update, delete on public.calendar_groups to service_role;

alter table public.calendars add column if not exists group_id uuid references public.calendar_groups on delete set null;
create index if not exists calendars_group_idx on public.calendars (group_id);

-- 2. More meeting places ------------------------------------------------------------------------
-- zoom: their Zoom meeting link. ask_booker: the person booking says where.
alter table public.calendars drop constraint if exists calendars_location_type_check;
alter table public.calendars add constraint calendars_location_type_check
  check (location_type in ('google_meet', 'teams', 'zoom', 'phone', 'in_person', 'link', 'ask_booker', 'none'));

-- 3. A meeting location per team member (blank: the calendar's own) --------------------------------
alter table public.calendar_members add column if not exists location_type text
  check (location_type is null or location_type in ('google_meet', 'teams', 'zoom', 'phone', 'in_person', 'link', 'ask_booker', 'none'));
alter table public.calendar_members add column if not exists location_value text not null default ''
  check (length(location_value) <= 300);

notify pgrst, 'reload schema';
