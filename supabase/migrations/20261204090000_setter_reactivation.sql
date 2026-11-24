-- SQL-12: lead reactivation for the AI setter.
--
-- The AI setter can now message old leads from GHL (chosen by tag) to bring them back.
-- A conversation remembers how it started (origin), and the AI's next step can be
-- 'reactivate' as well as the first message ('opener') and follow-ups ('followup').

alter table public.setter_threads add column if not exists origin text not null default 'lead';
alter table public.setter_threads drop constraint if exists setter_threads_origin_check;
alter table public.setter_threads add constraint setter_threads_origin_check check (origin in ('lead', 'reply', 'reactivation'));

alter table public.setter_threads drop constraint if exists setter_threads_next_action_check;
alter table public.setter_threads add constraint setter_threads_next_action_check
  check (next_action is null or next_action in ('opener', 'followup', 'reactivate'));

create index if not exists setter_threads_origin_idx on public.setter_threads (agent_id, origin);
