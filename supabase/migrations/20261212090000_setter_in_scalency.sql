-- The AI setter working inside Scalency (no GoHighLevel).
--
-- setter_agents.engine   'ghl' (as before) or 'scalency': uses this workspace's contacts,
--                        conversations (email and text) and a Scalency booking page.
-- setter_agents.calendar_id  the booking page it offers times from and books into.
-- setter_threads.contact_id  the Scalency contact (ghl_contact_id is set to 'sc:<contact id>'
--                            so the existing unique key and screens keep working).
-- setter_threads.pending_reply_at  set when the lead writes in; the ai-setter clock answers
--                                  a few seconds later (several texts in a row get one answer).
--
-- How leads reach it:
--   * Tag a contact "AI setter" (by hand or with a workflow's Add tag step): it sends the first
--     message and follows up. Removing the tag stops it.
--   * When a lead it's talking to replies by email or text, it answers.
--   * When the lead books (any way), it stops following up.

alter table public.setter_agents add column if not exists engine text not null default 'ghl';
alter table public.setter_agents drop constraint if exists setter_agents_engine_check;
alter table public.setter_agents add constraint setter_agents_engine_check check (engine in ('ghl', 'scalency'));
alter table public.setter_agents add column if not exists calendar_id uuid references public.calendars (id) on delete set null;

alter table public.setter_threads add column if not exists contact_id uuid references public.contacts (id) on delete cascade;
alter table public.setter_threads add column if not exists pending_reply_at timestamptz;
create index if not exists setter_threads_contact_idx on public.setter_threads (contact_id) where contact_id is not null;
create index if not exists setter_threads_pending_idx on public.setter_threads (pending_reply_at) where pending_reply_at is not null;

-- Tagging a contact "AI setter" hands them to the workspace's Scalency setter.
create or replace function public.setter_on_tag() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  tname text;
  ag record;
  c record;
begin
  select name into tname from public.tags where id = coalesce(new.tag_id, old.tag_id);
  if lower(trim(coalesce(tname, ''))) <> 'ai setter' then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    update public.setter_threads
       set state = 'stopped', next_action = null, next_action_at = null, pending_reply_at = null, note = 'The AI setter tag was removed.'
     where contact_id = old.contact_id and state in ('active', 'paused', 'finished');
    return old;
  end if;

  select id, account_id into ag from public.setter_agents
   where account_id = new.account_id and engine = 'scalency' and status <> 'off'
   order by updated_at desc limit 1;
  if ag.id is null then
    return new;
  end if;
  select id, first_name, last_name, email, phone into c from public.contacts where id = new.contact_id;
  if c.id is null then
    return new;
  end if;

  insert into public.setter_threads (agent_id, account_id, ghl_contact_id, contact_id, contact_name, channel, origin, state, next_action, next_action_at)
  values (ag.id, ag.account_id, 'sc:' || c.id, c.id, nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
          case when coalesce(c.phone, '') <> '' then 'SMS' else 'Email' end, 'lead', 'active', 'opener', now())
  on conflict (agent_id, ghl_contact_id) do update
     set state = 'active', next_action = 'opener', next_action_at = now(), touches = 0, note = null, contact_id = excluded.contact_id
   where public.setter_threads.state in ('stopped', 'finished', 'handed_over', 'paused');
  return new;
end;
$$;
revoke execute on function public.setter_on_tag() from public, anon, authenticated;

drop trigger if exists setter_tag_added on public.contact_tags;
create trigger setter_tag_added after insert on public.contact_tags for each row execute function public.setter_on_tag();
drop trigger if exists setter_tag_removed on public.contact_tags;
create trigger setter_tag_removed after delete on public.contact_tags for each row execute function public.setter_on_tag();

-- A lead it's talking to writes in: answer them (the clock picks this up).
create or replace function public.setter_on_inbound() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.direction <> 'inbound' or new.contact_id is null then
    return new;
  end if;
  update public.setter_threads t
     set pending_reply_at = now(), last_inbound_at = now(),
         state = case when t.state = 'finished' then 'active' else t.state end,
         channel = case when new.channel = 'email' then 'Email' else 'SMS' end
   where t.contact_id = new.contact_id
     and t.state in ('active', 'finished')
     and exists (select 1 from public.setter_agents a where a.id = t.agent_id and a.engine = 'scalency' and a.status <> 'off');
  return new;
end;
$$;
revoke execute on function public.setter_on_inbound() from public, anon, authenticated;

drop trigger if exists setter_inbound on public.messages;
create trigger setter_inbound after insert on public.messages for each row execute function public.setter_on_inbound();

-- They booked (through the AI, a booking page, the team or Calendly): stop following up.
create or replace function public.setter_on_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.contact_id is null or new.status not in ('booked', 'confirmed') then
    return new;
  end if;
  update public.setter_threads
     set state = 'booked', next_action = null, next_action_at = null, pending_reply_at = null,
         booked_at = coalesce(booked_at, now()), appointment_at = new.starts_at, appointment_id = new.id::text
   where contact_id = new.contact_id and state in ('active', 'finished', 'paused');
  return new;
end;
$$;
revoke execute on function public.setter_on_booking() from public, anon, authenticated;

drop trigger if exists setter_booking on public.appointments;
create trigger setter_booking after insert on public.appointments for each row execute function public.setter_on_booking();

-- The setter posts hand-overs in the team's Leads chat.
grant execute on function public.chat_channel_for(uuid, text) to service_role;
