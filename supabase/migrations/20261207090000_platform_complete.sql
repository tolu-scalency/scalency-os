-- SQL-15: show-up reminders, QA scoring, test lab, voice calls, creative studio, ad spend and
-- AI setter version history.
--
-- setter_threads: confirmed_at (they replied YES or GHL marked it confirmed), reminder_step (the
-- last reminder sent: 0 = 3 days, 1 = 48 hours, 2 = 24 hours, 3 = 2 hours), and the QA grade.
-- The AI's next step can now be a reminder or a no-show follow-up.

alter table public.setter_threads add column if not exists confirmed_at timestamptz;
alter table public.setter_threads add column if not exists reminder_step integer check (reminder_step is null or reminder_step between -1 and 10);
alter table public.setter_threads add column if not exists qa_score integer check (qa_score is null or qa_score between 0 and 100);
alter table public.setter_threads add column if not exists qa_notes jsonb;
alter table public.setter_threads add column if not exists qa_at timestamptz;

alter table public.setter_threads drop constraint if exists setter_threads_next_action_check;
alter table public.setter_threads add constraint setter_threads_next_action_check
  check (next_action is null or next_action in ('opener', 'followup', 'reactivate', 'missed_call', 'review', 'rebook', 'reminder', 'noshow'));

create index if not exists setter_threads_qa_idx on public.setter_threads (agent_id, qa_at);

-- Voice AI calls (Vapi or Retell): one row per call, with its summary and transcript.
create table if not exists public.setter_calls (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  agent_id uuid not null,
  thread_id uuid references public.setter_threads (id) on delete set null,
  provider text not null check (provider in ('vapi', 'retell')),
  provider_call_id text,
  direction text not null default 'outbound' check (direction in ('outbound', 'inbound')),
  purpose text,
  status text not null default 'started' check (status in ('started', 'ended')),
  phone text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  summary text,
  transcript text,
  recording_url text,
  ended_reason text,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  foreign key (agent_id, account_id) references public.setter_agents (id, account_id) on delete cascade
);
create index if not exists setter_calls_account_idx on public.setter_calls (account_id, created_at desc);
create index if not exists setter_calls_provider_idx on public.setter_calls (provider_call_id);

-- Test lab runs (the 50-conversation test): each scripted conversation and its grade.
create table if not exists public.setter_lab_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  agent_id uuid not null,
  scenario integer not null,
  passed boolean not null,
  score integer,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (agent_id, account_id) references public.setter_agents (id, account_id) on delete cascade
);
create index if not exists setter_lab_runs_agent_idx on public.setter_lab_runs (agent_id, created_at desc);

-- Every save of an AI setter's settings, so a change can be undone (versioned prompts).
create table if not exists public.setter_versions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  agent_id uuid not null,
  name text,
  business jsonb not null,
  rules jsonb not null,
  saved_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (agent_id, account_id) references public.setter_agents (id, account_id) on delete cascade
);
create index if not exists setter_versions_agent_idx on public.setter_versions (agent_id, created_at desc);

-- Creative studio: ad and post copy with a UK ad-rules check and sign-off.
create table if not exists public.creatives (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  channel text not null default 'Meta ad' check (length(channel) <= 40),
  headline text not null default '' check (length(headline) <= 200),
  body text not null default '' check (length(body) <= 2000),
  cta text not null default '' check (length(cta) <= 80),
  image_idea text not null default '' check (length(image_idea) <= 300),
  brief text check (brief is null or length(brief) <= 1000),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'rejected')),
  compliance jsonb not null default '{}'::jsonb,
  review_note text check (review_note is null or length(review_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creatives_account_idx on public.creatives (account_id, status, updated_at desc);

-- Ad spend per lead source and month (typed in), for cost per lead, booking and shown consult.
create table if not exists public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  month date not null,
  source text not null check (length(source) between 1 and 80),
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (account_id, month, source)
);

-- Access: members read; AI managers run the AI parts; marketing managers run creatives and spend.
alter table public.setter_calls enable row level security;
alter table public.setter_lab_runs enable row level security;
alter table public.setter_versions enable row level security;
alter table public.creatives enable row level security;
alter table public.ad_spend enable row level security;

drop policy if exists "Setter calls: read" on public.setter_calls;
create policy "Setter calls: read" on public.setter_calls for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Setter lab: read" on public.setter_lab_runs;
create policy "Setter lab: read" on public.setter_lab_runs for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Setter versions: read" on public.setter_versions;
create policy "Setter versions: read" on public.setter_versions for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Setter versions: save" on public.setter_versions;
create policy "Setter versions: save" on public.setter_versions for insert to authenticated with check (account_id in (select public.accounts_where_i_can('ai.manage')));
drop policy if exists "Setter versions: tidy" on public.setter_versions;
create policy "Setter versions: tidy" on public.setter_versions for delete to authenticated using (account_id in (select public.accounts_where_i_can('ai.manage')));

drop policy if exists "Creatives: read" on public.creatives;
create policy "Creatives: read" on public.creatives for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Creatives: manage" on public.creatives;
create policy "Creatives: manage" on public.creatives for all to authenticated
  using (account_id in (select public.accounts_where_i_can('marketing.manage')) or account_id in (select public.accounts_where_i_can('ai.manage')))
  with check (account_id in (select public.accounts_where_i_can('marketing.manage')) or account_id in (select public.accounts_where_i_can('ai.manage')));

drop policy if exists "Ad spend: read" on public.ad_spend;
create policy "Ad spend: read" on public.ad_spend for select to authenticated using (public.is_account_member(account_id));
drop policy if exists "Ad spend: manage" on public.ad_spend;
create policy "Ad spend: manage" on public.ad_spend for all to authenticated
  using (account_id in (select public.accounts_where_i_can('marketing.manage')) or account_id in (select public.accounts_where_i_can('reporting.view')))
  with check (account_id in (select public.accounts_where_i_can('marketing.manage')) or account_id in (select public.accounts_where_i_can('reporting.view')));

revoke all on public.setter_calls, public.setter_lab_runs, public.setter_versions, public.creatives, public.ad_spend from anon, authenticated;
grant select on public.setter_calls, public.setter_lab_runs to authenticated;
grant select, insert, delete on public.setter_versions to authenticated;
grant select, insert, update, delete on public.creatives, public.ad_spend to authenticated;
grant select, insert, update, delete on public.setter_calls, public.setter_lab_runs, public.setter_versions, public.creatives, public.ad_spend to service_role;
