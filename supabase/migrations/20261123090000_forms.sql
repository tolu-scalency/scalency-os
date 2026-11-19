-- Forms: embeddable lead forms that create or update the contact, tag them,
-- optionally add a deal, and start workflows ("Form submitted" trigger).
--
-- Reuses the forms and form_submissions tables from the application journey:
-- * forms.definition holds { fields: [...], button, success_message, consent, theme }.
-- * New columns: tags (added to everyone who submits), stage_id (optional deal),
--   redirect_url (send people to a page after submitting).
-- * form_submissions gets a 'submitted' status for one-step forms.
-- Public submissions go through the app's /api/forms/<id> route with the service key,
-- so no public database access is opened up.
-- Managing forms now needs sites.manage (it was settings.manage).

alter table public.forms add column if not exists tags text[] not null default '{}';
alter table public.forms add column if not exists stage_id uuid;
alter table public.forms add column if not exists redirect_url text check (redirect_url is null or redirect_url ~ '^https://');
alter table public.forms drop constraint if exists forms_stage_fk;
alter table public.forms add constraint forms_stage_fk foreign key (stage_id) references public.pipeline_stages (id) on delete set null;
create index if not exists forms_account_idx on public.forms (account_id, created_at desc);

alter table public.form_submissions drop constraint if exists form_submissions_status_check;
alter table public.form_submissions add constraint form_submissions_status_check
  check (status in ('started', 'qualified', 'unqualified', 'submitted'));
create index if not exists form_submissions_account_idx on public.form_submissions (account_id, started_at desc);

-- Who can build forms: sites.manage instead of settings.manage.
drop policy if exists "Settings: insert" on public.forms;
drop policy if exists "Settings: update" on public.forms;
drop policy if exists "Settings: delete" on public.forms;
drop policy if exists "Sites: insert" on public.forms;
drop policy if exists "Sites: update" on public.forms;
drop policy if exists "Sites: delete" on public.forms;
create policy "Sites: insert" on public.forms as restrictive for insert to authenticated
  with check (account_id in (select public.accounts_where_i_can('sites.manage')));
create policy "Sites: update" on public.forms as restrictive for update to authenticated
  using (account_id in (select public.accounts_where_i_can('sites.manage')));
create policy "Sites: delete" on public.forms as restrictive for delete to authenticated
  using (account_id in (select public.accounts_where_i_can('sites.manage')));

-- "Form submitted" workflows: { type: 'form_submitted', form_id?: uuid }.
create or replace function public.workflows_on_form_submitted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
begin
  if new.status not in ('submitted', 'qualified') or (tg_op = 'UPDATE' and old.status = new.status) then
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

drop trigger if exists form_submitted_workflows on public.form_submissions;
create trigger form_submitted_workflows after insert or update of status on public.form_submissions
  for each row execute function public.workflows_on_form_submitted();
