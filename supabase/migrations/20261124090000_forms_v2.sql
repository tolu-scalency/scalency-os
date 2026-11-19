-- Forms, version 2 (Form Studio): multi-step forms, saving people who stop part
-- way, and qualifying by score.
--
-- * "Form submitted" workflows now also start for qualified and not-a-fit
--   submissions (tags tell them apart), not only plain ones. "started" (someone
--   who stopped part way) never starts them.
-- * Faster look-ups for resuming a part-finished submission.
-- * ai_form_runs: a log of "Build with AI" drafts, for the daily limit.

create or replace function public.workflows_on_form_submitted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
begin
  if new.status not in ('submitted', 'qualified', 'unqualified') or (tg_op = 'UPDATE' and old.status = new.status) then
    return new;
  end if;
  for wf in select id from public.workflows where account_id = new.account_id and status = 'active'
    and trigger ->> 'type' = 'form_submitted'
    and coalesce(nullif(trigger ->> 'form_id', ''), 'any') in ('any', new.form_id::text) loop
    perform public.enroll_contact(wf.id, new.contact_id);
  end loop;
  return new;
end;
$$;

create index if not exists form_submissions_resume_idx on public.form_submissions (form_id, (tracking ->> 'resume')) where status = 'started';

-- "Build with AI": one row per AI draft, so each workspace has a daily limit.
-- Only people who can build forms can read or add their workspace's rows.
create table if not exists public.ai_form_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  created_by uuid default auth.uid(),
  prompt text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ai_form_runs_account_idx on public.ai_form_runs (account_id, created_at desc);
alter table public.ai_form_runs enable row level security;
drop policy if exists "Sites: read AI runs" on public.ai_form_runs;
drop policy if exists "Sites: add AI runs" on public.ai_form_runs;
create policy "Sites: read AI runs" on public.ai_form_runs for select to authenticated
  using (account_id in (select public.accounts_where_i_can('sites.manage')));
create policy "Sites: add AI runs" on public.ai_form_runs for insert to authenticated
  with check (account_id in (select public.accounts_where_i_can('sites.manage')) and created_by = auth.uid());
