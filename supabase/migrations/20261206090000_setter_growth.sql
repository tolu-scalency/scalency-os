-- SQL-14: growth features for the AI setter (competitor features build).
--
-- Conversations now remember where the lead came from (lead_source), what they had done
-- (treatment), what it was worth (revenue), when they showed up (showed_at) and when they're due
-- back (rebook_at). Conversations can also start from a missed call or a rebooking reminder, and
-- the AI's next step can be a missed-call text, a review request or a rebooking reminder.
--
-- setter_knowledge is the Knowledge bank: approved questions and answers the AI uses word for
-- word, added by hand or suggested by the website scan (suggestions stay unapproved until checked).

alter table public.setter_threads add column if not exists lead_source text check (lead_source is null or length(lead_source) <= 80);
alter table public.setter_threads add column if not exists treatment text check (treatment is null or length(treatment) <= 80);
alter table public.setter_threads add column if not exists revenue numeric(12, 2) check (revenue is null or revenue >= 0);
alter table public.setter_threads add column if not exists showed_at timestamptz;
alter table public.setter_threads add column if not exists rebook_at timestamptz;

alter table public.setter_threads drop constraint if exists setter_threads_origin_check;
alter table public.setter_threads add constraint setter_threads_origin_check
  check (origin in ('lead', 'reply', 'reactivation', 'missed_call', 'rebooking'));

alter table public.setter_threads drop constraint if exists setter_threads_next_action_check;
alter table public.setter_threads add constraint setter_threads_next_action_check
  check (next_action is null or next_action in ('opener', 'followup', 'reactivate', 'missed_call', 'review', 'rebook'));

create index if not exists setter_threads_showed_idx on public.setter_threads (account_id, showed_at);
create index if not exists setter_threads_source_idx on public.setter_threads (account_id, lead_source);

create table if not exists public.setter_knowledge (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  agent_id uuid not null,
  question text not null check (length(question) between 1 and 300),
  answer text not null check (length(answer) between 1 and 1500),
  -- manual (typed in), website (from the website scan) or document (pasted from a document)
  source text not null default 'manual' check (source in ('manual', 'website', 'document')),
  approved boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (agent_id, account_id) references public.setter_agents (id, account_id) on delete cascade
);
create index if not exists setter_knowledge_agent_idx on public.setter_knowledge (agent_id, approved, created_at);

alter table public.setter_knowledge enable row level security;
drop policy if exists "Setter knowledge: read" on public.setter_knowledge;
create policy "Setter knowledge: read" on public.setter_knowledge for select to authenticated
  using (public.is_account_member(account_id));
-- People who can set up AI add, check, change and remove answers.
drop policy if exists "Setter knowledge: manage" on public.setter_knowledge;
create policy "Setter knowledge: manage" on public.setter_knowledge for all to authenticated
  using (account_id in (select public.accounts_where_i_can('ai.manage')))
  with check (account_id in (select public.accounts_where_i_can('ai.manage')));

revoke all on public.setter_knowledge from anon, authenticated;
grant select, insert, update, delete on public.setter_knowledge to authenticated;
grant select, insert, update, delete on public.setter_knowledge to service_role;
