-- SQL-16: team replies in the command centre, and saved AI opportunity audits.
--
-- setter_turns.role can now be 'team': a message a team member sent from Scalency's command centre.
-- audits: the AI opportunity audit reports (intake answers, website scan and the report), per workspace.

alter table public.setter_turns drop constraint if exists setter_turns_role_check;
alter table public.setter_turns add constraint setter_turns_role_check check (role in ('lead', 'ai', 'event', 'team'));

create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  business_name text not null check (length(business_name) between 1 and 200),
  website text check (website is null or length(website) <= 300),
  answers jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  monthly_total numeric(12, 2) not null default 0,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists audits_account_idx on public.audits (account_id, created_at desc);

alter table public.audits enable row level security;
drop policy if exists "Audits: read" on public.audits;
create policy "Audits: read" on public.audits for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Audits: manage" on public.audits;
create policy "Audits: manage" on public.audits for all to authenticated
  using (account_id in (select public.accounts_where_i_can('ai.manage')) or account_id in (select public.accounts_where_i_can('marketing.manage')))
  with check (account_id in (select public.accounts_where_i_can('ai.manage')) or account_id in (select public.accounts_where_i_can('marketing.manage')));

revoke all on public.audits from anon, authenticated;
grant select, insert, delete on public.audits to authenticated;
grant select, insert, update, delete on public.audits to service_role;
