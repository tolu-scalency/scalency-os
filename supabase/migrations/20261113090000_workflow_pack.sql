-- Workflow pack: more triggers and steps for the workflow builder, plus what they need.
--
-- New triggers: tag added, tag removed, deal won, deal lost, lead replied, webhook received.
-- New steps: wait until a time, wait for a reply, if/else, add or remove a tag, assign an owner,
-- mark deal won or lost, add to or remove from another workflow, send a webhook, end.
-- Also: contact owners, texting hours (quiet hours) in live mode, "stop when the lead replies",
-- unsubscribed contacts are never messaged, and a queue for outgoing webhooks.

-- ---------------------------------------------------------------------------
-- 1. New columns and the webhook queue
-- ---------------------------------------------------------------------------

-- Who looks after this contact.
alter table public.contacts add column owner_id uuid references auth.users on delete set null;
create index contacts_owner_idx on public.contacts (account_id, owner_id);

-- When on, a reply from the lead takes them out of this workflow (unless it's waiting for that reply).
alter table public.workflows add column stop_on_reply boolean not null default true;
create index workflows_trigger_type_idx on public.workflows (account_id, (trigger ->> 'type')) where status = 'active';
create index workflows_webhook_token_idx on public.workflows ((trigger ->> 'token')) where trigger ->> 'type' = 'webhook';

-- Webhooks a workflow sends out. The app's clock posts them and records the result.
create table public.outbound_webhooks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  enrollment_id uuid,
  url text not null check (url ~ '^https://'),
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  response_status integer,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key (enrollment_id, account_id) references public.workflow_enrollments (id, account_id) on delete set null (enrollment_id)
);
create index outbound_webhooks_queued_idx on public.outbound_webhooks (created_at) where status = 'queued';
alter table public.outbound_webhooks enable row level security;
create policy "Members see their accounts' webhooks" on public.outbound_webhooks for select to authenticated
  using (public.is_account_member(account_id));
revoke all on public.outbound_webhooks from anon;
grant select on public.outbound_webhooks to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------

-- Turns "3 hours" into an interval. Negative or missing amounts count as zero.
create function public.wf_interval(amount text, unit text) returns interval
language sql immutable set search_path = '' as $$
  select case unit
    when 'minutes' then make_interval(mins => greatest(coalesce(nullif(amount, '')::integer, 0), 0))
    when 'days' then make_interval(days => greatest(coalesce(nullif(amount, '')::integer, 0), 0))
    else make_interval(hours => greatest(coalesce(nullif(amount, '')::integer, 0), 0))
  end;
$$;
revoke execute on function public.wf_interval(text, text) from public, anon, authenticated;

-- The workspace's local time right now.
create function public.account_local_now(target_account uuid) returns timestamp
language sql stable security definer set search_path = '' as $$
  select now() at time zone coalesce(a.timezone, 'Europe/London') from public.accounts a where a.id = target_account;
$$;
revoke execute on function public.account_local_now(uuid) from public, anon, authenticated;

-- Null if texts may go out now, otherwise when the texting window next opens.
-- Only applies in live mode, so testing works at any hour.
create function public.sms_window_opens(target_account uuid) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  a record;
  local_now timestamp;
begin
  select timezone, sms_window_start, sms_window_end, test_mode into a from public.accounts where id = target_account;
  if a.test_mode then
    return null;
  end if;
  local_now := now() at time zone a.timezone;
  if local_now::time >= a.sms_window_start and local_now::time < a.sms_window_end then
    return null;
  end if;
  if local_now::time < a.sms_window_start then
    return (local_now::date + a.sms_window_start) at time zone a.timezone;
  end if;
  return (local_now::date + 1 + a.sms_window_start) at time zone a.timezone;
end;
$$;
revoke execute on function public.sms_window_opens(uuid) from public, anon, authenticated;

-- The next time the clock in the workspace reads hour:minute (optionally Monday to Friday only).
create function public.next_local_time(target_account uuid, at_hour integer, at_minute integer, weekdays_only boolean)
returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text;
  local_now timestamp;
  target timestamp;
begin
  select coalesce(timezone, 'Europe/London') into tz from public.accounts where id = target_account;
  local_now := now() at time zone tz;
  target := local_now::date + make_time(least(greatest(at_hour, 0), 23), least(greatest(at_minute, 0), 59), 0);
  if target <= local_now then
    target := target + interval '1 day';
  end if;
  while weekdays_only and extract(isodow from target) in (6, 7) loop
    target := target + interval '1 day';
  end loop;
  return target at time zone tz;
end;
$$;
revoke execute on function public.next_local_time(uuid, integer, integer, boolean) from public, anon, authenticated;

-- Finds or creates a tag by name.
create function public.tag_id_for(target_account uuid, tag_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  clean text := left(trim(tag_name), 40);
  found uuid;
begin
  if clean = '' or clean is null then
    return null;
  end if;
  select id into found from public.tags where account_id = target_account and lower(name) = lower(clean);
  if found is null then
    insert into public.tags (account_id, name) values (target_account, clean)
    on conflict (account_id, name) do nothing returning id into found;
    if found is null then
      select id into found from public.tags where account_id = target_account and lower(name) = lower(clean);
    end if;
  end if;
  return found;
end;
$$;
revoke execute on function public.tag_id_for(uuid, text) from public, anon, authenticated;

-- Checks an if/else condition for a contact. "since" is when they entered the workflow.
create function public.wf_condition(cond jsonb, target_contact uuid, since timestamptz) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  c record;
  v text := coalesce(cond ->> 'value', '');
  result boolean;
begin
  select * into c from public.contacts where id = target_contact;
  if c.id is null then
    return false;
  end if;
  result := case cond ->> 'field'
    when 'has_tag' then exists (
      select 1 from public.contact_tags ct join public.tags t on t.id = ct.tag_id
      where ct.contact_id = c.id and lower(t.name) = lower(trim(v)))
    when 'has_email' then c.email is not null
    when 'has_phone' then c.phone is not null
    when 'replied' then exists (
      select 1 from public.messages m where m.contact_id = c.id and m.direction = 'inbound' and m.created_at >= since)
    when 'in_stage' then exists (select 1 from public.opportunities o where o.contact_id = c.id and o.stage_id::text = v)
    when 'deal_status' then coalesce((select o.status from public.opportunities o where o.contact_id = c.id order by o.updated_at desc limit 1), '') = v
    when 'source_is' then lower(coalesce(c.source, '')) = lower(trim(v))
    when 'has_owner' then c.owner_id is not null
    else false
  end;
  if coalesce((cond ->> 'negate')::boolean, false) then
    return not result;
  end if;
  return result;
end;
$$;
revoke execute on function public.wf_condition(jsonb, uuid, timestamptz) from public, anon, authenticated;

-- Fills in {{first_name}}, {{last_name}}, {{name}}, {{email}}, {{phone}}, {{source}} and {{workspace}}.
create or replace function public.render_template(body text, target_contact uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select replace(replace(replace(replace(replace(replace(replace(coalesce(body, ''),
    '{{first_name}}', coalesce(c.first_name, 'there')),
    '{{last_name}}', coalesce(c.last_name, '')),
    '{{name}}', trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
    '{{email}}', coalesce(c.email, '')),
    '{{phone}}', coalesce(c.phone, '')),
    '{{source}}', coalesce(c.source, '')),
    '{{workspace}}', a.name)
  from public.contacts c join public.accounts a on a.id = c.account_id
  where c.id = target_contact;
$$;
revoke execute on function public.render_template(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The engine, with the new steps
-- ---------------------------------------------------------------------------

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
      exit steps when guard > 60;

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
            insert into public.messages (account_id, contact_id, enrollment_id, direction, channel, to_address, subject, body, status)
            values (e.account_id, e.contact_id, e.id, 'outbound', kind, addr,
                    case when kind = 'email' then public.render_template(step ->> 'subject', e.contact_id) end,
                    public.render_template(step ->> 'body', e.contact_id),
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
          tag := public.tag_id_for(e.account_id, step ->> 'tag');
          if tag is null then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'No tag chosen');
          elsif kind = 'add_tag' then
            insert into public.contact_tags (account_id, contact_id, tag_id) values (e.account_id, e.contact_id, tag) on conflict do nothing;
            info := jsonb_build_object('tag', step ->> 'tag');
          else
            delete from public.contact_tags where contact_id = e.contact_id and tag_id = tag;
            info := jsonb_build_object('tag', step ->> 'tag');
          end if;

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

        when 'end' then
          jump := total;

        else
          outcome := 'skipped';
          info := jsonb_build_object('reason', 'Unknown step');
      end case;

      insert into public.workflow_step_runs (account_id, enrollment_id, step_key, action, outcome, detail)
      values (e.account_id, e.id, idx::text, kind, outcome, info);

      -- Another step (assign, add to workflow) may have taken this enrolment out; respect that.
      if not exists (select 1 from public.workflow_enrollments where id = e.id and status in ('active', 'waiting')) then
        exit steps;
      end if;

      if jump is not null and jump >= total then
        update public.workflow_enrollments
        set status = 'completed', current_step = total::text, finished_at = now(), next_run_at = null,
            exit_reason = case when kind = 'end' then 'Ended at step ' || (idx + 1) else 'Condition not met at step ' || (idx + 1) end
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

-- ---------------------------------------------------------------------------
-- 4. New triggers
-- ---------------------------------------------------------------------------

-- Tag added or removed.
create function public.workflows_on_tag_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
  row_data record;
  tag_name text;
  kind text := case when tg_op = 'INSERT' then 'tag_added' else 'tag_removed' end;
begin
  if tg_op = 'INSERT' then row_data := new; else row_data := old; end if;
  -- When a contact is deleted its tags go too; don't enrol someone who no longer exists.
  if not exists (select 1 from public.contacts where id = row_data.contact_id) then
    return null;
  end if;
  select name into tag_name from public.tags where id = row_data.tag_id;
  insert into public.activity (account_id, contact_id, type, summary)
  values (row_data.account_id, row_data.contact_id, 'tag.' || case when tg_op = 'INSERT' then 'added' else 'removed' end,
          case when tg_op = 'INSERT' then 'Tag added: ' else 'Tag removed: ' end || coalesce(tag_name, ''));
  for wf in select id from public.workflows where account_id = row_data.account_id and status = 'active'
    and trigger ->> 'type' = kind and lower(trigger ->> 'tag') = lower(tag_name) loop
    perform public.enroll_contact(wf.id, row_data.contact_id);
  end loop;
  return null;
end;
$$;
create trigger workflows_on_tag_change after insert or delete on public.contact_tags
  for each row execute function public.workflows_on_tag_change();

-- Deal marked won or lost.
create function public.workflows_on_deal_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
begin
  if new.status is not distinct from old.status or new.status not in ('won', 'lost') then
    return new;
  end if;
  for wf in select id from public.workflows where account_id = new.account_id and status = 'active'
    and trigger ->> 'type' = 'deal_' || new.status loop
    perform public.enroll_contact(wf.id, new.contact_id);
  end loop;
  return new;
end;
$$;
create trigger workflows_on_deal_status after update of status on public.opportunities
  for each row execute function public.workflows_on_deal_status();

-- The lead replied: wake workflows waiting for a reply, take them out of "stop on reply"
-- workflows, then start any "lead replied" workflows.
create function public.workflows_on_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
begin
  if new.direction <> 'inbound' or new.contact_id is null then
    return new;
  end if;

  update public.workflow_enrollments en
  set status = 'active', next_run_at = now()
  where en.contact_id = new.contact_id and en.status in ('active', 'waiting') and en.context ? 'awaiting_reply';

  update public.workflow_enrollments en
  set status = 'exited', exit_reason = 'Lead replied', finished_at = now(), next_run_at = null
  from public.workflows w
  where w.id = en.workflow_id and w.stop_on_reply and en.contact_id = new.contact_id
    and en.status in ('active', 'waiting') and not (en.context ? 'awaiting_reply');

  for wf in select id from public.workflows where account_id = new.account_id and status = 'active'
    and trigger ->> 'type' = 'message_received'
    and coalesce(nullif(trigger ->> 'channel', ''), 'any') in ('any', new.channel) loop
    perform public.enroll_contact(wf.id, new.contact_id);
  end loop;
  return new;
end;
$$;
create trigger workflows_on_reply after insert on public.messages
  for each row execute function public.workflows_on_reply();

-- ---------------------------------------------------------------------------
-- 5. The server (secret key) runs the engine for webhooks, text replies and the clock
-- ---------------------------------------------------------------------------
do $$
begin
  grant execute on function public.run_due_workflows(uuid) to service_role;
  grant execute on function public.enroll_contact(uuid, uuid) to service_role;
  grant select, insert, update, delete on public.outbound_webhooks to service_role;
exception when undefined_object then
  raise notice 'service_role not found here: %', sqlerrm;
end $$;
