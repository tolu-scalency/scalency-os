-- Trigger filters (like GHL's "Add filters" on a trigger).
-- A workflow's trigger can carry `filters` (a list of If / else conditions) and `filter_match`
-- ('all' or 'any'). When the trigger fires, the contact only enters the workflow if the filters pass,
-- checked at that moment. Adding someone by hand (contact page, bulk add) skips the filters.
--
-- Every way into a workflow goes through public.enroll_contact, which inserts into
-- workflow_enrollments, so one check before that insert covers every trigger.

create or replace function public.workflow_enrollment_filters()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tr jsonb;
  f jsonb;
  any_mode boolean;
begin
  if coalesce(current_setting('scalency.by_hand', true), '') = 'on' then
    return new;
  end if;
  select w.trigger into tr from public.workflows w where w.id = new.workflow_id;
  if tr is null or jsonb_typeof(tr -> 'filters') is distinct from 'array' or jsonb_array_length(tr -> 'filters') = 0 then
    return new;
  end if;
  any_mode := coalesce(tr ->> 'filter_match', 'all') = 'any';
  for f in select value from jsonb_array_elements(tr -> 'filters') loop
    if public.wf_condition(f, new.contact_id, now()) then
      if any_mode then return new; end if;
    else
      if not any_mode then return null; end if;
    end if;
  end loop;
  -- all: every filter passed. any: none passed.
  if any_mode then return null; end if;
  return new;
end;
$$;
revoke execute on function public.workflow_enrollment_filters() from public, anon, authenticated;

drop trigger if exists enrollment_filters on public.workflow_enrollments;
create trigger enrollment_filters before insert on public.workflow_enrollments
  for each row execute function public.workflow_enrollment_filters();

-- Adding a contact to a workflow by hand: the trigger's filters don't apply.
create or replace function public.enroll_contact_by_hand(target_workflow uuid, target_contact uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform set_config('scalency.by_hand', 'on', true);
  new_id := public.enroll_contact(target_workflow, target_contact);
  perform set_config('scalency.by_hand', '', true);
  return new_id;
end;
$$;
revoke execute on function public.enroll_contact_by_hand(uuid, uuid) from public, anon;
grant execute on function public.enroll_contact_by_hand(uuid, uuid) to authenticated;
