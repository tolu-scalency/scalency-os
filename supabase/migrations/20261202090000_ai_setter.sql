-- AI setter: an AI that texts new leads straight away, answers their questions,
-- books them into the clinic's calendar and follows up when they go quiet, using
-- Tolu's setter SOP. It works inside each client's GoHighLevel sub-account for now
-- (GHL's calendar, numbers and inbox); the edge function ai-setter does the work.
--
-- setter_agents  : one AI setter per business: its details, rules, GHL connection
--                  and status (off, test or live).
-- setter_threads : one conversation per lead: where it's up to and when the next
--                  follow-up is due.
-- setter_turns   : every message in and out, plus what the AI did (booked, handed
--                  over...). Test chat turns have no thread.
-- Safe to run more than once.

create table if not exists public.setter_agents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null default 'AI setter' check (length(name) between 1 and 120),
  -- off: does nothing. test: only talks to contacts tagged "ai-test". live: every lead.
  status text not null default 'off' check (status in ('off', 'test', 'live')),
  -- The business details, offer, prices, rules and tone the AI works from.
  business jsonb not null default '{}'::jsonb,
  -- When it may send messages first, follow-up days, and whether to create tasks for the team.
  rules jsonb not null default '{}'::jsonb,
  -- GoHighLevel: the sub-account (location), calendar and pipeline it uses.
  ghl_location_id text,
  ghl_location_name text,
  ghl_calendar_id text,
  ghl_calendar_name text,
  ghl_pipeline_id text,
  -- Stage IDs to move deals to: {"contacted": "...", "booked": "...", "not_interested": "..."}
  ghl_stages jsonb not null default '{}'::jsonb,
  -- The Private Integration key, encrypted by the ai-setter function. Never readable by people.
  ghl_token text,
  ghl_checked_at timestamptz,
  ghl_error text,
  -- Part of the webhook address GHL calls, so only that sub-account's workflows can reach this setter.
  webhook_key text not null default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id)
);
create index if not exists setter_agents_account_idx on public.setter_agents (account_id);
create index if not exists setter_agents_location_idx on public.setter_agents (ghl_location_id);

create table if not exists public.setter_threads (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  account_id uuid not null,
  ghl_contact_id text not null,
  contact_name text,
  -- active: in conversation or being followed up. booked, handed_over (a person takes it
  -- from here), stopped (said no or opted out), paused (a team member replied themselves),
  -- finished (no reply after every follow-up).
  state text not null default 'active' check (state in ('active', 'booked', 'handed_over', 'stopped', 'paused', 'finished')),
  -- The channel to use: SMS, Email, WhatsApp, IG, FB or Live_Chat.
  channel text not null default 'SMS',
  -- Follow-ups sent since the lead last replied, and in total.
  touches integer not null default 0,
  total_touches integer not null default 0,
  -- When the AI should act next: send the first message or the next follow-up.
  next_action_at timestamptz,
  next_action text check (next_action is null or next_action in ('opener', 'followup')),
  -- Several texts in a row get one answer: the newest message sets this, and only it replies.
  reply_token text,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  -- Message IDs the AI sent, so a team member's own replies can be told apart.
  sent_ids text[] not null default '{}',
  booked_at timestamptz,
  appointment_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (agent_id, account_id) references public.setter_agents (id, account_id) on delete cascade,
  unique (agent_id, ghl_contact_id)
);
create index if not exists setter_threads_due_idx on public.setter_threads (next_action_at) where state = 'active' and next_action_at is not null;
create index if not exists setter_threads_agent_idx on public.setter_threads (agent_id, updated_at desc);

create table if not exists public.setter_turns (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  agent_id uuid,
  thread_id uuid references public.setter_threads (id) on delete cascade,
  -- lead: from the lead. ai: sent by the AI. event: something the AI did (booked, handed over...).
  role text not null check (role in ('lead', 'ai', 'event')),
  body text not null default '' check (length(body) <= 8000),
  channel text,
  -- What the AI did or why, for the log: {"action": "booked", "at": "..."}
  meta jsonb not null default '{}'::jsonb,
  -- Test chat turns are kept for the daily limit only.
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists setter_turns_thread_idx on public.setter_turns (thread_id, created_at);
create index if not exists setter_turns_test_idx on public.setter_turns (account_id, created_at) where is_test;

-- Stops the follow-up clock running twice at the same time.
create table if not exists public.setter_clock (
  id integer primary key default 1 check (id = 1),
  last_run_at timestamptz not null default 'epoch'
);
insert into public.setter_clock (id) values (1) on conflict do nothing;

create or replace function public.claim_setter_tick() returns boolean
language sql security definer set search_path = '' as $$
  with c as (
    update public.setter_clock set last_run_at = now()
    where id = 1 and last_run_at < now() - interval '45 seconds'
    returning 1
  )
  select exists (select 1 from c);
$$;
revoke execute on function public.claim_setter_tick() from public, anon, authenticated;
grant execute on function public.claim_setter_tick() to service_role;

drop trigger if exists set_updated_at on public.setter_agents;
create trigger set_updated_at before update on public.setter_agents for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.setter_threads;
create trigger set_updated_at before update on public.setter_threads for each row execute function public.set_updated_at();

-- Access: members can see their workspace's setters and conversations; people with
-- "Manage AI" can set them up. The GHL key and webhook key are never readable from the
-- app: the ai-setter function writes the key, and the app asks the server for the
-- webhook address.
alter table public.setter_agents enable row level security;
alter table public.setter_threads enable row level security;
alter table public.setter_turns enable row level security;
alter table public.setter_clock enable row level security;

drop policy if exists "Setter agents: read" on public.setter_agents;
create policy "Setter agents: read" on public.setter_agents for select to authenticated
  using (public.is_account_member(account_id));
drop policy if exists "Setter agents: add" on public.setter_agents;
create policy "Setter agents: add" on public.setter_agents for insert to authenticated
  with check (account_id in (select public.accounts_where_i_can('ai.manage')));
drop policy if exists "Setter agents: change" on public.setter_agents;
create policy "Setter agents: change" on public.setter_agents for update to authenticated
  using (account_id in (select public.accounts_where_i_can('ai.manage')))
  with check (account_id in (select public.accounts_where_i_can('ai.manage')));
drop policy if exists "Setter agents: remove" on public.setter_agents;
create policy "Setter agents: remove" on public.setter_agents for delete to authenticated
  using (account_id in (select public.accounts_where_i_can('ai.manage')));

drop policy if exists "Setter threads: read" on public.setter_threads;
create policy "Setter threads: read" on public.setter_threads for select to authenticated
  using (public.is_account_member(account_id));
drop policy if exists "Setter threads: change" on public.setter_threads;
create policy "Setter threads: change" on public.setter_threads for update to authenticated
  using (account_id in (select public.accounts_where_i_can('ai.manage')))
  with check (account_id in (select public.accounts_where_i_can('ai.manage')));

drop policy if exists "Setter turns: read" on public.setter_turns;
create policy "Setter turns: read" on public.setter_turns for select to authenticated
  using (public.is_account_member(account_id) and not is_test);

revoke all on public.setter_agents, public.setter_threads, public.setter_turns, public.setter_clock from anon, authenticated;
grant select (id, account_id, name, status, business, rules, ghl_location_id, ghl_location_name, ghl_calendar_id, ghl_calendar_name, ghl_pipeline_id, ghl_stages, ghl_checked_at, ghl_error, created_at, updated_at) on public.setter_agents to authenticated;
grant insert (account_id, name, status, business, rules) on public.setter_agents to authenticated;
grant update (name, status, business, rules, ghl_location_id, ghl_calendar_id, ghl_calendar_name, ghl_pipeline_id, ghl_stages) on public.setter_agents to authenticated;
grant delete on public.setter_agents to authenticated;
grant select on public.setter_threads to authenticated;
grant update (state, next_action_at, next_action, note) on public.setter_threads to authenticated;
grant select on public.setter_turns to authenticated;
grant select, insert, update, delete on public.setter_agents, public.setter_threads, public.setter_turns, public.setter_clock to service_role;
