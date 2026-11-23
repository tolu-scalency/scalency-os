-- SQL-11: copying GHL contacts into Scalency.
--
-- The AI setter can import a GHL sub-account's contacts and copy each new GHL lead into
-- Scalency (one way only). Those contacts have source 'GHL' and custom->>'ghl_id'.
-- GHL stays in charge of messaging them, so a copied contact must not start Scalency
-- workflows (no "contact created" or "tag added" enrolments). Everything else is unchanged.

create index if not exists contacts_ghl_id_idx on public.contacts (account_id, (custom ->> 'ghl_id')) where custom ? 'ghl_id';

create or replace function public.workflows_on_contact_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
begin
  -- Copied from GHL: GHL handles them.
  if new.source = 'GHL' then
    return new;
  end if;
  for wf in select id from public.workflows where account_id = new.account_id and status = 'active' and trigger ->> 'type' = 'contact_created' loop
    perform public.enroll_contact(wf.id, new.id);
  end loop;
  return new;
end;
$$;

create or replace function public.workflows_on_tag_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
  row_data record;
  tag_name text;
  from_ghl boolean;
  kind text := case when tg_op = 'INSERT' then 'tag_added' else 'tag_removed' end;
begin
  if tg_op = 'INSERT' then row_data := new; else row_data := old; end if;
  -- When a contact is deleted its tags go too; don't enrol someone who no longer exists.
  select source = 'GHL' into from_ghl from public.contacts where id = row_data.contact_id;
  if not found then
    return null;
  end if;
  select name into tag_name from public.tags where id = row_data.tag_id;
  insert into public.activity (account_id, contact_id, type, summary)
  values (row_data.account_id, row_data.contact_id, 'tag.' || case when tg_op = 'INSERT' then 'added' else 'removed' end,
          case when tg_op = 'INSERT' then 'Tag added: ' else 'Tag removed: ' end || coalesce(tag_name, ''));
  -- Copied from GHL: GHL handles them.
  if coalesce(from_ghl, false) then
    return null;
  end if;
  for wf in select id from public.workflows where account_id = row_data.account_id and status = 'active'
    and trigger ->> 'type' = kind and lower(trigger ->> 'tag') = lower(tag_name) loop
    perform public.enroll_contact(wf.id, row_data.contact_id);
  end loop;
  return null;
end;
$$;
