-- SQL-13: the AI setter's brain, guardrails and setter console.
--
-- Each conversation now keeps what the AI has learned about the lead (qualification) and a lead
-- score from 0 to 100, when the AI first replied (speed to lead), the GHL appointment it booked
-- (so it can move or cancel it), and how many times the guardrails stepped in.
--
-- setter_handoffs is the setter console's queue: every lead the AI passes to a person, with a
-- reason, a priority (urgent, high, medium) and who picked it up.

alter table public.setter_threads add column if not exists lead_score integer check (lead_score is null or lead_score between 0 and 100);
alter table public.setter_threads add column if not exists qualification jsonb not null default '{}'::jsonb;
alter table public.setter_threads add column if not exists first_reply_at timestamptz;
alter table public.setter_threads add column if not exists appointment_id text;
alter table public.setter_threads add column if not exists guardrail_flags integer not null default 0;
-- What happened to the booked appointment, from GHL's appointment status (for show and no-show rates).
alter table public.setter_threads add column if not exists appointment_status text check (appointment_status is null or appointment_status in ('confirmed', 'showed', 'noshow', 'cancelled'));
alter table public.setter_threads add column if not exists appointment_status_at timestamptz;

create table if not exists public.setter_handoffs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  agent_id uuid not null,
  thread_id uuid not null references public.setter_threads (id) on delete cascade,
  -- person, high_value, stalled, price, medical, complication, complaint, appointment, question, other
  category text not null default 'other',
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium')),
  reason text not null,
  summary text,
  status text not null default 'open' check (status in ('open', 'claimed', 'done')),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  done_at timestamptz,
  outcome text,
  created_at timestamptz not null default now(),
  foreign key (agent_id, account_id) references public.setter_agents (id, account_id) on delete cascade
);
create index if not exists setter_handoffs_queue_idx on public.setter_handoffs (account_id, status, priority, created_at);
create index if not exists setter_handoffs_thread_idx on public.setter_handoffs (thread_id);

alter table public.setter_handoffs enable row level security;
drop policy if exists "Setter handoffs: read" on public.setter_handoffs;
create policy "Setter handoffs: read" on public.setter_handoffs for select to authenticated
  using (public.is_account_member(account_id));
-- Anyone who can send messages for the clinic can pick up and close a handoff.
drop policy if exists "Setter handoffs: work" on public.setter_handoffs;
create policy "Setter handoffs: work" on public.setter_handoffs for update to authenticated
  using (account_id in (select public.accounts_where_i_can('inbox.send')) or account_id in (select public.accounts_where_i_can('ai.manage')))
  with check (account_id in (select public.accounts_where_i_can('inbox.send')) or account_id in (select public.accounts_where_i_can('ai.manage')));

revoke all on public.setter_handoffs from anon, authenticated;
grant select on public.setter_handoffs to authenticated;
grant update (status, claimed_by, claimed_at, done_at, outcome) on public.setter_handoffs to authenticated;
grant select, insert, update, delete on public.setter_handoffs to service_role;
