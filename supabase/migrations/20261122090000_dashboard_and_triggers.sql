-- Editable home dashboard, and pipeline-aware workflow triggers.
--
-- * accounts.dashboard: the workspace's home layout, a list of widgets
--   ({ id, type, size, settings }). Empty means "use the default". Saved with
--   save_dashboard(), which needs settings.manage (owners and admins by default).
-- * Workflow triggers:
--     stage_entered  { pipeline_id, stage_id }  stage_id may be "any" (any stage in that pipeline)
--     deal_created   { pipeline_id? }           a new deal, in one pipeline or any
--     deal_won / deal_lost { pipeline_id? }      optionally only in one pipeline
--     none                                       no trigger chosen yet (nothing starts it)

alter table public.accounts add column if not exists dashboard jsonb;

create or replace function public.save_dashboard(target uuid, layout jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if target not in (select public.accounts_where_i_can('settings.manage')) then
    raise exception 'Only people who can manage settings can change the home page.' using errcode = '42501';
  end if;
  if layout is not null and (jsonb_typeof(layout) <> 'array' or jsonb_array_length(layout) > 40 or length(layout::text) > 20000) then
    raise exception 'That layout is too big.' using errcode = '22023';
  end if;
  update public.accounts set dashboard = layout where id = target;
end;
$$;
revoke execute on function public.save_dashboard(uuid, jsonb) from public, anon;
grant execute on function public.save_dashboard(uuid, jsonb) to authenticated;

-- A contact entering a stage, or a new deal.
create or replace function public.workflows_on_stage_entered() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
begin
  if tg_op = 'INSERT' then
    for wf in select id from public.workflows where account_id = new.account_id and status = 'active'
      and trigger ->> 'type' = 'deal_created'
      and coalesce(nullif(trigger ->> 'pipeline_id', ''), 'any') in ('any', new.pipeline_id::text) loop
      perform public.enroll_contact(wf.id, new.contact_id);
    end loop;
  elsif new.stage_id is not distinct from old.stage_id then
    return new;
  end if;
  for wf in select id from public.workflows where account_id = new.account_id and status = 'active'
    and trigger ->> 'type' = 'stage_entered'
    and (trigger ->> 'stage_id' = new.stage_id::text
         or (trigger ->> 'stage_id' = 'any' and trigger ->> 'pipeline_id' = new.pipeline_id::text)) loop
    perform public.enroll_contact(wf.id, new.contact_id);
  end loop;
  return new;
end;
$$;

create or replace function public.workflows_on_deal_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
begin
  if new.status is not distinct from old.status or new.status not in ('won', 'lost') then
    return new;
  end if;
  for wf in select id from public.workflows where account_id = new.account_id and status = 'active'
    and trigger ->> 'type' = 'deal_' || new.status
    and coalesce(nullif(trigger ->> 'pipeline_id', ''), 'any') in ('any', new.pipeline_id::text) loop
    perform public.enroll_contact(wf.id, new.contact_id);
  end loop;
  return new;
end;
$$;
