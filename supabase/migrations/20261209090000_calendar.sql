-- SQL-18: Calendar. Booking pages, team availability, appointments, and connections to
-- Google Calendar (Meet), Microsoft Outlook (Teams) and Calendly. Every booking becomes a
-- contact and an appointment, can move a deal to a stage, and starts "Appointment booked"
-- workflows. Workflows get a new step, "Wait until before or after the appointment", and
-- appointment merge fields ({{appointment_date}}, {{meeting_link}} and so on).
--
-- Tokens for connected calendars are encrypted by the app before they're stored, and the
-- browser can never read them (column-level grants below).

-- 1. Booking pages ("calendars") ---------------------------------------------------------

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name text not null check (length(name) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  description text not null default '' check (length(description) <= 1000),
  -- one: always the first member. round_robin: the free member whose turn it is.
  kind text not null default 'one' check (kind in ('one', 'round_robin')),
  duration_min integer not null default 30 check (duration_min between 5 and 480),
  slot_step_min integer not null default 30 check (slot_step_min between 5 and 240),
  buffer_before_min integer not null default 0 check (buffer_before_min between 0 and 240),
  buffer_after_min integer not null default 0 check (buffer_after_min between 0 and 240),
  min_notice_min integer not null default 240 check (min_notice_min between 0 and 43200),
  max_days_ahead integer not null default 30 check (max_days_ahead between 1 and 365),
  daily_limit integer not null default 0 check (daily_limit between 0 and 100),
  location_type text not null default 'google_meet' check (location_type in ('google_meet', 'teams', 'phone', 'in_person', 'link', 'none')),
  location_value text not null default '' check (length(location_value) <= 300),
  questions jsonb not null default '[]' check (jsonb_typeof(questions) = 'array'),
  stage_id uuid references public.pipeline_stages (id) on delete set null,
  tags text[] not null default '{}',
  confirm_email boolean not null default true,
  notify_team boolean not null default true,
  thank_you text not null default '' check (length(thank_you) <= 1000),
  redirect_url text check (redirect_url is null or redirect_url ~ '^https://'),
  color text not null default '#0465C7' check (color ~ '^#[0-9a-fA-F]{6}$'),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, slug),
  unique (id, account_id)
);
create index if not exists calendars_account_idx on public.calendars (account_id, status);

-- Who takes bookings on each calendar. priority 0 pauses someone without removing them.
create table if not exists public.calendar_members (
  calendar_id uuid not null,
  account_id uuid not null references public.accounts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  priority integer not null default 1 check (priority between 0 and 10),
  last_booked_at timestamptz,
  primary key (calendar_id, user_id),
  foreign key (calendar_id, account_id) references public.calendars (id, account_id) on delete cascade
);
create index if not exists calendar_members_user_idx on public.calendar_members (account_id, user_id);

-- 2. Working hours, per person per workspace ------------------------------------------------
-- weekly: {"1": [["09:00","17:00"]], ...} keyed by weekday (0 = Sunday).
-- overrides: [{"date": "2026-12-25", "ranges": []}] (empty ranges = day off).
create table if not exists public.calendar_availability (
  account_id uuid not null references public.accounts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  timezone text not null default 'Europe/London' check (length(timezone) <= 60),
  weekly jsonb not null default '{"1":[["09:00","17:00"]],"2":[["09:00","17:00"]],"3":[["09:00","17:00"]],"4":[["09:00","17:00"]],"5":[["09:00","17:00"]]}',
  overrides jsonb not null default '[]' check (jsonb_typeof(overrides) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

-- 3. Connected calendars ------------------------------------------------------------------
create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'calendly')),
  account_email text,
  -- Calendly: the user's URI. Google and Microsoft: the calendar bookings are written to.
  external_user text,
  token_sealed text not null,
  refresh_sealed text,
  expires_at timestamptz,
  check_conflicts boolean not null default true,
  add_bookings boolean not null default true,
  status text not null default 'connected' check (status in ('connected', 'error')),
  last_error text,
  last_synced_at timestamptz,
  sync_cursor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, user_id, provider)
);

-- 4. Appointments -------------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  calendar_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  assigned_to uuid references auth.users on delete set null,
  title text not null default '' check (length(title) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booker_timezone text,
  status text not null default 'booked' check (status in ('booked', 'confirmed', 'showed', 'no_show', 'cancelled')),
  source text not null default 'booking_page' check (source in ('booking_page', 'manual', 'calendly', 'google', 'microsoft', 'ai', 'api')),
  location_type text,
  location text,
  meeting_url text,
  answers jsonb not null default '[]',
  notes text not null default '' check (length(notes) <= 5000),
  -- Where the event lives outside Scalency (the Google or Outlook event we wrote, or the Calendly booking we imported).
  external_provider text check (external_provider is null or external_provider in ('google', 'microsoft', 'calendly')),
  external_id text,
  external_calendar uuid references public.calendar_connections (id) on delete set null,
  -- The private link the booker uses to reschedule or cancel.
  manage_token text unique,
  cancel_reason text,
  cancelled_at timestamptz,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (id, account_id),
  foreign key (calendar_id, account_id) references public.calendars (id, account_id) on delete set null (calendar_id),
  foreign key (contact_id, account_id) references public.contacts (id, account_id) on delete set null (contact_id),
  foreign key (opportunity_id, account_id) references public.opportunities (id, account_id) on delete set null (opportunity_id)
);
create index if not exists appointments_account_time_idx on public.appointments (account_id, starts_at);
create index if not exists appointments_member_time_idx on public.appointments (assigned_to, starts_at) where status <> 'cancelled';
create index if not exists appointments_contact_idx on public.appointments (contact_id, starts_at desc);
create unique index if not exists appointments_external_key on public.appointments (account_id, external_provider, external_id) where external_id is not null;

-- 5. Access -------------------------------------------------------------------------------
alter table public.calendars enable row level security;
alter table public.calendar_members enable row level security;
alter table public.calendar_availability enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "Calendars: read" on public.calendars;
create policy "Calendars: read" on public.calendars for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Calendars: manage" on public.calendars;
create policy "Calendars: manage" on public.calendars for all to authenticated
  using (account_id in (select public.accounts_where_i_can('calendars.manage')))
  with check (account_id in (select public.accounts_where_i_can('calendars.manage')));

drop policy if exists "Calendar members: read" on public.calendar_members;
create policy "Calendar members: read" on public.calendar_members for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Calendar members: manage" on public.calendar_members;
create policy "Calendar members: manage" on public.calendar_members for all to authenticated
  using (account_id in (select public.accounts_where_i_can('calendars.manage')))
  with check (account_id in (select public.accounts_where_i_can('calendars.manage')));

drop policy if exists "Availability: read" on public.calendar_availability;
create policy "Availability: read" on public.calendar_availability for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Availability: own or manager" on public.calendar_availability;
create policy "Availability: own or manager" on public.calendar_availability for all to authenticated
  using ((user_id = (select auth.uid()) and public.is_account_member(account_id)) or account_id in (select public.accounts_where_i_can('calendars.manage')))
  with check ((user_id = (select auth.uid()) and public.is_account_member(account_id)) or account_id in (select public.accounts_where_i_can('calendars.manage')));

-- Connections: people see their own, managers see everyone's. Writes go through the server only.
drop policy if exists "Connections: read" on public.calendar_connections;
create policy "Connections: read" on public.calendar_connections for select to authenticated
  using ((user_id = (select auth.uid()) and public.is_account_member(account_id)) or account_id in (select public.accounts_where_i_can('calendars.manage')));

drop policy if exists "Appointments: read" on public.appointments;
create policy "Appointments: read" on public.appointments for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Appointments: manage" on public.appointments;
create policy "Appointments: manage" on public.appointments for update to authenticated
  using (account_id in (select public.accounts_where_i_can('calendars.manage')) or (assigned_to = (select auth.uid()) and public.is_account_member(account_id)))
  with check (account_id in (select public.accounts_where_i_can('calendars.manage')) or (assigned_to = (select auth.uid()) and public.is_account_member(account_id)));
drop policy if exists "Appointments: delete" on public.appointments;
create policy "Appointments: delete" on public.appointments for delete to authenticated
  using (account_id in (select public.accounts_where_i_can('calendars.manage')));

revoke all on public.calendars, public.calendar_members, public.calendar_availability, public.calendar_connections, public.appointments from anon, authenticated;
grant select, insert, update, delete on public.calendars, public.calendar_members, public.calendar_availability to authenticated;
grant select, update, delete on public.appointments to authenticated;
-- The browser can see which calendars are connected, never the tokens.
grant select (id, account_id, user_id, provider, account_email, check_conflicts, add_bookings, status, last_error, last_synced_at, created_at, updated_at)
  on public.calendar_connections to authenticated;
do $$
begin
  grant select, insert, update, delete on public.calendars, public.calendar_members, public.calendar_availability, public.calendar_connections, public.appointments to service_role;
exception when undefined_object then
  raise notice 'service_role not found here: %', sqlerrm;
end $$;

-- 6. Workflows: appointment triggers ------------------------------------------------------
-- Triggers: appointment_booked, appointment_cancelled, appointment_no_show, appointment_showed,
-- each with an optional calendar_id. Enrolments remember the appointment, so "wait until
-- before the appointment" steps follow a reschedule, and a cancellation stops reminders.
create or replace function public.workflows_on_appointment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
  kind text;
  new_id uuid;
begin
  if new.contact_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    kind := case when new.status in ('booked', 'confirmed') then 'appointment_booked' else null end;
  elsif new.status is distinct from old.status then
    kind := case new.status
      when 'cancelled' then 'appointment_cancelled'
      when 'no_show' then 'appointment_no_show'
      when 'showed' then 'appointment_showed'
      else null end;
    if new.status = 'cancelled' then
      update public.workflow_enrollments
         set status = 'exited', exit_reason = 'Appointment cancelled', finished_at = now(), next_run_at = null
       where account_id = new.account_id and status in ('active', 'waiting')
         and context ->> 'appointment_id' = new.id::text;
    end if;
  end if;

  -- Rescheduled: move the timers of anything waiting on this appointment.
  if tg_op = 'UPDATE' and new.starts_at is distinct from old.starts_at and new.status not in ('cancelled') then
    update public.workflow_enrollments e
       set event_at = new.starts_at,
           next_run_at = case
             when e.status = 'waiting' and (w.steps -> (coalesce(nullif(e.current_step, '')::integer, 1) - 1) ->> 'type') = 'wait_appointment'
             then greatest(now(), new.starts_at + (case when (w.steps -> (coalesce(nullif(e.current_step, '')::integer, 1) - 1) ->> 'when') = 'after' then 1 else -1 end)
                  * public.wf_interval(w.steps -> (coalesce(nullif(e.current_step, '')::integer, 1) - 1) ->> 'amount',
                                       w.steps -> (coalesce(nullif(e.current_step, '')::integer, 1) - 1) ->> 'unit'))
             else e.next_run_at end
      from public.workflows w
     where w.id = e.workflow_id and e.account_id = new.account_id and e.status in ('active', 'waiting')
       and e.context ->> 'appointment_id' = new.id::text;
  end if;

  if kind is null then
    return new;
  end if;
  for wf in select id from public.workflows where account_id = new.account_id and status = 'active'
    and trigger ->> 'type' = kind
    and coalesce(nullif(trigger ->> 'calendar_id', ''), 'any') in ('any', coalesce(new.calendar_id::text, 'none')) loop
    new_id := public.enroll_contact(wf.id, new.contact_id);
    if new_id is not null then
      update public.workflow_enrollments
         set event_at = new.starts_at, context = context || jsonb_build_object('appointment_id', new.id)
       where id = new_id;
    end if;
  end loop;
  return new;
end;
$$;
revoke execute on function public.workflows_on_appointment() from public, anon, authenticated;

drop trigger if exists appointment_workflows on public.appointments;
create trigger appointment_workflows after insert or update of status, starts_at on public.appointments
  for each row execute function public.workflows_on_appointment();

-- Keep updated_at fresh.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists calendars_touch on public.calendars;
create trigger calendars_touch before update on public.calendars for each row execute function public.touch_updated_at();
drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments for each row execute function public.touch_updated_at();
drop trigger if exists calendar_connections_touch on public.calendar_connections;
create trigger calendar_connections_touch before update on public.calendar_connections for each row execute function public.touch_updated_at();

-- 7. Appointment merge fields -----------------------------------------------------------
-- The link the app is served from, for reschedule links in messages.
create or replace function public.app_url() returns text language sql immutable set search_path = '' as $$
  select 'https://os.scalency.us'::text;
$$;

-- The contact's appointment for a message: the one the workflow was started for if
-- given, otherwise their next one (or the one that just happened, up to 12 hours ago).
create or replace function public.render_appointment_fields(body text, target_contact uuid, target_appointment uuid default null)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  a record;
  tz text;
  out text := coalesce(body, '');
begin
  select ap.*, cal.name as calendar_name, acc.timezone as account_tz,
         coalesce(nullif(p.full_name, ''), u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)) as with_name
    into a
    from public.appointments ap
    join public.accounts acc on acc.id = ap.account_id
    left join public.calendars cal on cal.id = ap.calendar_id
    left join auth.users u on u.id = ap.assigned_to
    left join public.profiles p on p.user_id = ap.assigned_to
   where ap.contact_id = target_contact
     and (target_appointment is null or ap.id = target_appointment)
     and (target_appointment is not null or (ap.status in ('booked', 'confirmed') and ap.starts_at > now() - interval '12 hours'))
   order by ap.starts_at
   limit 1;
  if a.id is null then
    return regexp_replace(out, '\{\{(appointment_[a-z_]+|meeting_link|manage_link)\}\}', '', 'g');
  end if;
  tz := coalesce(nullif(a.booker_timezone, ''), a.account_tz, 'Europe/London');
  out := replace(out, '{{appointment_date}}', to_char(a.starts_at at time zone tz, 'FMDay FMDD FMMonth'));
  out := replace(out, '{{appointment_time}}', lower(to_char(a.starts_at at time zone tz, 'FMHH12:MIam')));
  out := replace(out, '{{appointment_timezone}}', replace(tz, '_', ' '));
  out := replace(out, '{{appointment_with}}', coalesce(a.with_name, ''));
  out := replace(out, '{{appointment_title}}', coalesce(nullif(a.title, ''), a.calendar_name, 'Appointment'));
  out := replace(out, '{{appointment_location}}', coalesce(a.location, ''));
  out := replace(out, '{{meeting_link}}', coalesce(a.meeting_url, ''));
  out := replace(out, '{{manage_link}}', case when a.manage_token is null then '' else public.app_url() || '/booking/' || a.manage_token end);
  return regexp_replace(out, '\{\{appointment_[a-z_]+\}\}', '', 'g');
end;
$$;
revoke execute on function public.render_appointment_fields(text, uuid, uuid) from public, anon, authenticated;

-- 8. Messages can use appointment fields (same function as before, plus the appointment hook).
create or replace function public.render_template(body text, target_contact uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c record;
  acc record;
  owner record;
  deal record;
  out text := coalesce(body, '');
  k text;
  v text;
  j jsonb;
  t text;
  local_now timestamp;
begin
  select * into c from public.contacts where id = target_contact;
  if c.id is null then
    return out;
  end if;
  select name, timezone into acc from public.accounts where id = c.account_id;
  local_now := now() at time zone coalesce(acc.timezone, 'Europe/London');
  select coalesce(nullif(p.full_name, ''), u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)) as full_name,
         coalesce(p.email, u.email) as email, p.phone
    into owner
    from auth.users u left join public.profiles p on p.user_id = u.id
   where u.id = c.owner_id;

  out := replace(out, '{{first_name}}', coalesce(c.first_name, 'there'));
  out := replace(out, '{{last_name}}', coalesce(c.last_name, ''));
  out := replace(out, '{{name}}', trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')));
  out := replace(out, '{{email}}', coalesce(c.email, ''));
  out := replace(out, '{{phone}}', coalesce(c.phone, ''));
  out := replace(out, '{{source}}', coalesce(c.source, ''));
  out := replace(out, '{{workspace}}', coalesce(acc.name, ''));
  out := replace(out, '{{owner_name}}', coalesce(owner.full_name, ''));
  out := replace(out, '{{owner_first_name}}', coalesce(split_part(owner.full_name, ' ', 1), ''));
  out := replace(out, '{{owner_email}}', coalesce(owner.email, ''));
  out := replace(out, '{{owner_phone}}', coalesce(owner.phone, ''));
  out := replace(out, '{{added_date}}', to_char(c.created_at at time zone coalesce(acc.timezone, 'Europe/London'), 'FMDD Mon YYYY'));
  out := replace(out, '{{today}}', to_char(local_now, 'FMDD Mon YYYY'));
  out := replace(out, '{{weekday}}', to_char(local_now, 'FMDay'));
  out := replace(out, '{{year}}', to_char(local_now, 'YYYY'));

  if position('{{tags}}' in out) > 0 then
    out := replace(out, '{{tags}}', coalesce((
      select string_agg(tg.name, ', ' order by tg.name)
      from public.contact_tags ct join public.tags tg on tg.id = ct.tag_id
      where ct.contact_id = c.id), ''));
  end if;

  if position('{{deal_' in out) > 0 or position('{{pipeline}}' in out) > 0 then
    select o.name, o.value_pence, o.status, s.name as stage, pl.name as pipeline
      into deal
      from public.opportunities o
      left join public.pipeline_stages s on s.id = o.stage_id
      left join public.pipelines pl on pl.id = o.pipeline_id
     where o.contact_id = c.id
     order by o.updated_at desc
     limit 1;
    out := replace(out, '{{deal_name}}', coalesce(deal.name, ''));
    out := replace(out, '{{deal_value}}', case when deal.value_pence is null then '' else '£' || to_char(deal.value_pence / 100.0, 'FM999,999,990.00') end);
    out := replace(out, '{{deal_stage}}', coalesce(deal.stage, ''));
    out := replace(out, '{{deal_status}}', coalesce(deal.status, ''));
    out := replace(out, '{{pipeline}}', coalesce(deal.pipeline, ''));
  end if;

  if position('{{contact.' in out) > 0 then
    for k, j, t in
      select e.key, e.value, cf.type
      from jsonb_each(c.custom) e
      left join public.custom_fields cf on cf.account_id = c.account_id and cf.object = 'contact' and cf.key = e.key
    loop
      v := case
        when jsonb_typeof(j) = 'array' then (select string_agg(x, ', ') from jsonb_array_elements_text(j) x)
        when jsonb_typeof(j) = 'boolean' then case when j = 'true'::jsonb then 'Yes' else 'No' end
        when t = 'money' and jsonb_typeof(j) = 'number' then to_char((j #>> '{}')::numeric, 'FM999,999,999,990.00')
        when t = 'date' and (j #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$' then to_char((j #>> '{}')::date, 'FMDD Mon YYYY')
        else j #>> '{}'
      end;
      out := replace(out, '{{contact.' || k || '}}', coalesce(v, ''));
    end loop;
    out := regexp_replace(out, '\{\{contact\.[a-z0-9_]+\}\}', '', 'g');
  end if;
  if position('{{custom_values.' in out) > 0 then
    for k, v in select cv.key, cv.value from public.custom_values cv where cv.account_id = c.account_id loop
      out := replace(out, '{{custom_values.' || k || '}}', v);
    end loop;
    out := regexp_replace(out, '\{\{custom_values\.[a-z0-9_]+\}\}', '', 'g');
  end if;
  if position('{{appointment_' in out) > 0 or position('{{meeting_link}}' in out) > 0 or position('{{manage_link}}' in out) > 0 then
    out := public.render_appointment_fields(out, c.id);
  end if;
  return out;
end;
$$;
revoke execute on function public.render_template(text, uuid) from public, anon, authenticated;

-- 9. The workflow engine (same as before, plus the "wait_appointment" step).
create or replace function public.run_due_workflows(target_account uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  wf record;
  acc record;
  c record;
  step jsonb;
  kind text;
  idx integer;
  total integer;
  processed integer := 0;
  guard integer;
  outcome text;
  info jsonb;
  addr text;
  until_at timestamptz;
  stage record;
  opp uuid;
  channel uuid;
  tag uuid;
  member uuid;
  jump integer;
  other uuid;
  field_key text;
  field_value text;
begin
  if (select auth.uid()) is not null and (target_account is null or not public.is_account_member(target_account)) then
    raise exception 'Not allowed.';
  end if;

  for e in
    select * from public.workflow_enrollments
    where status in ('active', 'waiting') and next_run_at <= now()
      and (target_account is null or account_id = target_account)
    order by next_run_at
    limit 500
    for update skip locked
  loop
    processed := processed + 1;
    select * into wf from public.workflows where id = e.workflow_id;
    select * into acc from public.accounts where id = e.account_id;
    total := jsonb_array_length(wf.steps);
    idx := coalesce(nullif(e.current_step, '')::integer, 0);
    guard := 0;

    -- Whatever woke it (a reply or the timer), it's no longer waiting for a reply.
    if e.context ? 'awaiting_reply' then
      update public.workflow_enrollments set context = context - 'awaiting_reply' where id = e.id;
    end if;

    -- Stop if the workflow was paused or archived.
    if wf.status <> 'active' then
      update public.workflow_enrollments set status = 'exited', exit_reason = 'Workflow turned off', finished_at = now(), next_run_at = null where id = e.id;
      continue;
    end if;

    <<steps>>
    loop
      if idx >= total then
        update public.workflow_enrollments set status = 'completed', current_step = idx::text, finished_at = now(), next_run_at = null where id = e.id;
        exit steps;
      end if;
      guard := guard + 1;
      -- Branch jumps add a few steps; anything left carries on next minute.
      exit steps when guard > 150;

      step := wf.steps -> idx;
      kind := coalesce(step ->> 'type', 'unknown');
      select * into c from public.contacts where id = e.contact_id;
      outcome := 'done';
      info := '{}';
      jump := null;

      case kind
        when 'wait' then
          until_at := now() + public.wf_interval(step ->> 'amount', step ->> 'unit');
          insert into public.workflow_step_runs (account_id, enrollment_id, step_key, action, outcome, detail)
          values (e.account_id, e.id, idx::text, kind, 'waiting', jsonb_build_object('until', until_at));
          update public.workflow_enrollments set status = 'waiting', current_step = (idx + 1)::text, next_run_at = until_at where id = e.id;
          exit steps;

        when 'wait_until' then
          until_at := public.next_local_time(e.account_id, coalesce((step ->> 'hour')::integer, 9), coalesce((step ->> 'minute')::integer, 0),
                                             coalesce((step ->> 'weekdays_only')::boolean, false));
          insert into public.workflow_step_runs (account_id, enrollment_id, step_key, action, outcome, detail)
          values (e.account_id, e.id, idx::text, kind, 'waiting', jsonb_build_object('until', until_at));
          update public.workflow_enrollments set status = 'waiting', current_step = (idx + 1)::text, next_run_at = until_at where id = e.id;
          exit steps;

        when 'wait_for_reply' then
          until_at := now() + public.wf_interval(step ->> 'amount', step ->> 'unit');
          insert into public.workflow_step_runs (account_id, enrollment_id, step_key, action, outcome, detail)
          values (e.account_id, e.id, idx::text, kind, 'waiting', jsonb_build_object('until', until_at));
          update public.workflow_enrollments
          set status = 'waiting', current_step = (idx + 1)::text, next_run_at = until_at,
              context = context || '{"awaiting_reply": true}'
          where id = e.id;
          exit steps;

        when 'email', 'sms' then
          if kind = 'sms' then
            until_at := public.sms_window_opens(e.account_id);
            if until_at is not null then
              -- Outside texting hours: try this same step again when the window opens.
              insert into public.workflow_step_runs (account_id, enrollment_id, step_key, action, outcome, detail)
              values (e.account_id, e.id, idx::text, kind, 'waiting', jsonb_build_object('until', until_at, 'reason', 'Outside texting hours'));
              update public.workflow_enrollments set status = 'waiting', current_step = idx::text, next_run_at = until_at where id = e.id;
              exit steps;
            end if;
          end if;
          addr := case when kind = 'email'
                    then case when acc.test_mode then acc.test_email else c.email end
                    else case when acc.test_mode then acc.test_phone else c.phone end end;
          if (kind = 'email' and c.email_unsubscribed_at is not null) or (kind = 'sms' and c.sms_unsubscribed_at is not null) then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'Contact unsubscribed from ' || case when kind = 'email' then 'emails' else 'texts' end);
          elsif addr is null or addr = '' then
            outcome := 'skipped';
            info := jsonb_build_object('reason', case when acc.test_mode then 'No test ' || case when kind = 'email' then 'email' else 'mobile' end || ' set in Settings' else 'Contact has no ' || case when kind = 'email' then 'email' else 'phone number' end end);
          else
            insert into public.messages (account_id, contact_id, enrollment_id, direction, channel, to_address, subject, body, html, status)
            values (e.account_id, e.contact_id, e.id, 'outbound', kind, addr,
                    case when kind = 'email' then public.render_template(step ->> 'subject', e.contact_id) end,
                    public.render_template(step ->> 'body', e.contact_id),
                    case when kind = 'email' and coalesce(step ->> 'html', '') <> '' then public.render_template(step ->> 'html', e.contact_id) end,
                    case when acc.test_mode then 'held_test_mode' else 'queued' end);
            insert into public.activity (account_id, contact_id, type, summary)
            values (e.account_id, e.contact_id, 'message.' || kind,
                    case when kind = 'email' then 'Email: ' || coalesce(public.render_template(step ->> 'subject', e.contact_id), '') else 'Text: ' || left(public.render_template(step ->> 'body', e.contact_id), 80) end
                    || case when acc.test_mode then ' (test mode)' else '' end);
            info := jsonb_build_object('to', addr, 'test_mode', acc.test_mode);
          end if;

        when 'task' then
          insert into public.tasks (account_id, title, due_on, contact_id, assigned_to)
          values (e.account_id, left(public.render_template(coalesce(step ->> 'title', 'Follow up'), e.contact_id), 200),
                  current_date + greatest(coalesce((step ->> 'due_in_days')::integer, 0), 0), e.contact_id, c.owner_id);

        when 'move_stage' then
          select * into stage from public.pipeline_stages where id = nullif(step ->> 'stage_id', '')::uuid and account_id = e.account_id;
          if stage.id is null then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'Stage no longer exists');
          else
            select id into opp from public.opportunities where contact_id = e.contact_id order by updated_at desc limit 1;
            if opp is null then
              insert into public.opportunities (account_id, contact_id, pipeline_id, stage_id, name, source, assigned_to)
              values (e.account_id, e.contact_id, stage.pipeline_id, stage.id, trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), 'workflow', c.owner_id);
            else
              update public.opportunities set stage_id = stage.id, pipeline_id = stage.pipeline_id where id = opp and stage_id <> stage.id;
            end if;
            insert into public.activity (account_id, contact_id, type, summary) values (e.account_id, e.contact_id, 'stage.changed', 'Moved to ' || stage.name || ' by a workflow');
          end if;

        when 'set_status' then
          select id into opp from public.opportunities where contact_id = e.contact_id order by updated_at desc limit 1;
          if opp is null then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'Contact has no deal');
          elsif coalesce(step ->> 'status', '') not in ('open', 'won', 'lost') then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'Unknown status');
          else
            update public.opportunities set status = step ->> 'status' where id = opp and status <> step ->> 'status';
            insert into public.activity (account_id, contact_id, type, summary)
            values (e.account_id, e.contact_id, 'deal.status', 'Deal marked ' || (step ->> 'status') || ' by a workflow');
          end if;

        when 'note' then
          insert into public.activity (account_id, contact_id, type, summary, detail)
          values (e.account_id, e.contact_id, 'note', public.render_template(coalesce(step ->> 'text', ''), e.contact_id), jsonb_build_object('author', wf.name));

        when 'notify_team' then
          channel := public.chat_channel_for(e.account_id, 'leads');
          insert into public.chat_messages (account_id, channel_id, author_id, body, contact_id)
          values (e.account_id, channel, null, public.render_template(coalesce(nullif(step ->> 'text', ''), 'New lead: {{name}}'), e.contact_id), e.contact_id);

        when 'add_tag', 'remove_tag' then
          -- One step can add or remove several tags ("tags" list); older steps have a single "tag".
          declare
            names text[] := coalesce(
              (select array_agg(x) from jsonb_array_elements_text(case when jsonb_typeof(step -> 'tags') = 'array' then step -> 'tags' else '[]'::jsonb end) x where trim(x) <> ''),
              case when coalesce(step ->> 'tag', '') <> '' then array[step ->> 'tag'] else '{}'::text[] end);
            one text;
          begin
            if cardinality(names) = 0 then
              outcome := 'skipped';
              info := jsonb_build_object('reason', 'No tag chosen');
            else
              foreach one in array names loop
                tag := public.tag_id_for(e.account_id, one);
                if tag is not null then
                  if kind = 'add_tag' then
                    insert into public.contact_tags (account_id, contact_id, tag_id) values (e.account_id, e.contact_id, tag) on conflict do nothing;
                  else
                    delete from public.contact_tags where contact_id = e.contact_id and tag_id = tag;
                  end if;
                end if;
              end loop;
              info := jsonb_build_object('tags', to_jsonb(names));
            end if;
          end;

        when 'assign' then
          if step ->> 'user_id' = 'round_robin' then
            -- The team member looking after the fewest contacts.
            select m.user_id into member from public.account_members m
            where m.account_id = e.account_id
            order by (select count(*) from public.contacts x where x.account_id = e.account_id and x.owner_id = m.user_id), m.created_at
            limit 1;
          else
            select m.user_id into member from public.account_members m
            where m.account_id = e.account_id and m.user_id::text = coalesce(step ->> 'user_id', '');
          end if;
          if member is null then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'That person is no longer in this workspace');
          else
            update public.contacts set owner_id = member where id = e.contact_id;
            update public.opportunities set assigned_to = member where contact_id = e.contact_id and status = 'open';
            info := jsonb_build_object('user_id', member);
          end if;

        when 'if_else' then
          if public.wf_condition(step -> 'condition', e.contact_id, e.entered_at) then
            info := jsonb_build_object('result', 'yes');
          else
            info := jsonb_build_object('result', 'no');
            if coalesce(step ->> 'else', 'end') = 'end' then
              jump := total;
            else
              select (t.ord - 1)::integer into jump
              from jsonb_array_elements(wf.steps) with ordinality as t(s, ord)
              where t.s ->> 'id' = step ->> 'else';
              -- Only forward jumps, so a workflow can never loop.
              if jump is null or jump <= idx then
                jump := total;
              end if;
            end if;
          end if;

        when 'branch' then
          -- Branches are checked from the top; the first match wins, otherwise the last branch.
          declare
            r jsonb;
            target text := null;
            taken text := null;
          begin
            for r in select x from jsonb_array_elements(case when jsonb_typeof(step -> 'routes') = 'array' then step -> 'routes' else '[]'::jsonb end) x loop
              if public.wf_match(r -> 'conditions', coalesce(r ->> 'match', 'all'), e.contact_id, e.entered_at) then
                target := coalesce(nullif(r ->> 'goto', ''), 'end');
                taken := coalesce(nullif(r ->> 'name', ''), 'Branch');
                exit;
              end if;
            end loop;
            if target is null then
              target := coalesce(nullif(step ->> 'otherwise_goto', ''), 'end');
              taken := coalesce(nullif(step ->> 'otherwise_name', ''), 'None');
            end if;
            info := jsonb_build_object('branch', taken);
            jump := public.wf_step_index(wf.steps, target, idx);
          end;

        when 'goto' then
          -- Skips past the branches that weren't taken. Not shown in the history.
          jump := public.wf_step_index(wf.steps, coalesce(step ->> 'target', 'end'), idx);

        when 'add_to_workflow' then
          other := nullif(step ->> 'workflow_id', '')::uuid;
          if other is null or other = wf.id or not exists (
            select 1 from public.workflows where id = other and account_id = e.account_id and status = 'active') then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'That workflow is not on');
          elsif public.enroll_contact(other, e.contact_id) is null then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'Already in that workflow');
          end if;

        when 'remove_from_workflow' then
          update public.workflow_enrollments
          set status = 'exited', exit_reason = 'Removed by ' || wf.name, finished_at = now(), next_run_at = null
          where workflow_id = nullif(step ->> 'workflow_id', '')::uuid and contact_id = e.contact_id
            and account_id = e.account_id and id <> e.id and status in ('active', 'waiting');

        when 'webhook' then
          if coalesce(step ->> 'url', '') !~ '^https://' then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'The address must start with https://');
          else
            insert into public.outbound_webhooks (account_id, enrollment_id, url, payload)
            values (e.account_id, e.id, step ->> 'url', jsonb_build_object(
              'event', 'workflow.webhook',
              'workflow', wf.name,
              'workspace', acc.name,
              'test_mode', acc.test_mode,
              'contact', jsonb_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name, 'email', c.email,
                                            'phone', c.phone, 'source', c.source, 'created_at', c.created_at,
                                            'tags', coalesce((select jsonb_agg(t.name order by t.name) from public.contact_tags ct join public.tags t on t.id = ct.tag_id where ct.contact_id = c.id), '[]'::jsonb))));
          end if;

        when 'update_field' then
          field_key := coalesce(step ->> 'field', '');
          field_value := left(public.render_template(coalesce(step ->> 'value', ''), e.contact_id), 500);
          if field_key in ('first_name', 'last_name', 'source') then
            execute format('update public.contacts set %I = $1 where id = $2', field_key) using nullif(field_value, ''), e.contact_id;
            info := jsonb_build_object('field', field_key, 'value', field_value);
          elsif field_key like 'custom:%' and substr(field_key, 8) ~ '^[a-z][a-z0-9_]*$' then
            update public.contacts set custom = custom || jsonb_build_object(substr(field_key, 8), field_value) where id = e.contact_id;
            info := jsonb_build_object('field', substr(field_key, 8), 'value', field_value);
          else
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'Unknown field');
          end if;

        when 'email_team' then
          -- An internal email to the team, not the lead, so test mode doesn't redirect it.
          addr := null;
          for member in
            select m.user_id from public.account_members m
            where m.account_id = e.account_id
              and case coalesce(step ->> 'to', 'owner')
                    when 'everyone' then true
                    when 'owner' then m.user_id = c.owner_id
                    else m.user_id::text = step ->> 'to' end
          loop
            select p.email into addr from public.profiles p where p.user_id = member;
            if addr is not null then
              insert into public.messages (account_id, contact_id, enrollment_id, direction, channel, to_address, subject, body, status)
              values (e.account_id, null, e.id, 'outbound', 'email', addr,
                      public.render_template(coalesce(nullif(step ->> 'subject', ''), 'Update on {{name}}'), e.contact_id),
                      public.render_template(coalesce(step ->> 'body', ''), e.contact_id), 'queued');
              info := info || jsonb_build_object(addr, 'queued');
            end if;
          end loop;
          if info = '{}'::jsonb then
            outcome := 'skipped';
            info := jsonb_build_object('reason', case when coalesce(step ->> 'to', 'owner') = 'owner' then 'Contact has no owner with an email' else 'Nobody to email' end);
          end if;
          member := null;

        when 'wait_appointment' then
          -- Wait until a set time before or after the appointment. Skipped if there's no
          -- appointment, or if that time has already passed (Automation Standards SOP).
          until_at := coalesce(e.event_at, (select ap.starts_at from public.appointments ap
                                             where ap.contact_id = e.contact_id and ap.status in ('booked', 'confirmed') and ap.starts_at > now()
                                             order by ap.starts_at limit 1));
          if until_at is null then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'No upcoming appointment');
          else
            until_at := until_at + (case when step ->> 'when' = 'after' then 1 else -1 end) * public.wf_interval(step ->> 'amount', step ->> 'unit');
            if until_at <= now() then
              outcome := 'skipped';
              info := jsonb_build_object('reason', 'That time has already passed', 'at', until_at);
            else
              insert into public.workflow_step_runs (account_id, enrollment_id, step_key, action, outcome, detail)
              values (e.account_id, e.id, idx::text, kind, 'waiting', jsonb_build_object('until', until_at));
              update public.workflow_enrollments set status = 'waiting', current_step = (idx + 1)::text, next_run_at = until_at where id = e.id;
              exit steps;
            end if;
          end if;

        when 'end' then
          jump := total;

        else
          outcome := 'skipped';
          info := jsonb_build_object('reason', 'Unknown step');
      end case;

      if kind <> 'goto' then
        insert into public.workflow_step_runs (account_id, enrollment_id, step_key, action, outcome, detail)
        values (e.account_id, e.id, idx::text, kind, outcome, info);
      end if;

      -- Another step (assign, add to workflow) may have taken this enrolment out; respect that.
      if not exists (select 1 from public.workflow_enrollments where id = e.id and status in ('active', 'waiting')) then
        exit steps;
      end if;

      if jump is not null and jump >= total then
        update public.workflow_enrollments
        set status = 'completed', current_step = total::text, finished_at = now(), next_run_at = null,
            exit_reason = case when kind = 'end' then 'Ended at an End step'
                               when kind = 'if_else' then 'Condition not met at step ' || (idx + 1)
                               else null end
        where id = e.id;
        exit steps;
      end if;
      idx := coalesce(jump, idx + 1);
      update public.workflow_enrollments set status = 'active', current_step = idx::text, next_run_at = now() where id = e.id;
    end loop steps;
  end loop;

  return processed;
end;
$$;
revoke execute on function public.run_due_workflows(uuid) from public, anon;
grant execute on function public.run_due_workflows(uuid) to authenticated;
