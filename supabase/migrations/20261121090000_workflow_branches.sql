-- Workflow builder with real branches (like GHL's If / else).
--
-- * workflows.graph keeps the builder's layout: a tree where each If / else has
--   named branches with their own steps. The app compiles it into workflows.steps,
--   the flat list the engine runs, so existing workflows keep working unchanged.
-- * New step types in the flat list:
--     branch: { routes: [{ name, match: all|any, conditions: [...], goto }], otherwise_name, otherwise_goto }
--     goto:   { target }   (skips past the branches that weren't taken)
--   Jumps only ever go forward, so a workflow can never loop.
-- * More conditions: any contact field (is, is not, contains, empty, more or less than),
--   assigned user, deal value, pipeline, day of the week and time of day.

alter table public.workflows add column if not exists graph jsonb;

-- Compares a text value: is, is_not, contains, not_contains, empty, not_empty, gt, lt.
create or replace function public.wf_compare(val text, op text, v text) returns boolean
language sql immutable set search_path = '' as $$
  select case coalesce(op, 'is')
    when 'is_not' then lower(coalesce(val, '')) <> lower(coalesce(v, ''))
    when 'contains' then position(lower(coalesce(v, '')) in lower(coalesce(val, ''))) > 0
    when 'not_contains' then position(lower(coalesce(v, '')) in lower(coalesce(val, ''))) = 0
    when 'empty' then coalesce(trim(val), '') = ''
    when 'not_empty' then coalesce(trim(val), '') <> ''
    when 'gt' then case when val ~ '^-?\d+(\.\d+)?$' and v ~ '^-?\d+(\.\d+)?$' then val::numeric > v::numeric else false end
    when 'lt' then case when val ~ '^-?\d+(\.\d+)?$' and v ~ '^-?\d+(\.\d+)?$' then val::numeric < v::numeric else false end
    else lower(coalesce(val, '')) = lower(coalesce(v, ''))
  end;
$$;
revoke execute on function public.wf_compare(text, text, text) from public, anon, authenticated;

create or replace function public.wf_condition(cond jsonb, target_contact uuid, since timestamptz) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  c record;
  v text := coalesce(cond ->> 'value', '');
  op text := coalesce(cond ->> 'op', '');
  k text := coalesce(cond ->> 'key', '');
  val text;
  num numeric;
  local_now timestamp;
  result boolean;
begin
  select * into c from public.contacts where id = target_contact;
  if c.id is null then
    return false;
  end if;
  select now() at time zone coalesce(a.timezone, 'Europe/London') into local_now from public.accounts a where a.id = c.account_id;

  case cond ->> 'field'
    when 'has_tag' then
      result := exists (
        select 1 from public.contact_tags ct join public.tags t on t.id = ct.tag_id
        where ct.contact_id = c.id and lower(t.name) = lower(trim(v)));
    when 'has_email' then result := c.email is not null and c.email <> '';
    when 'has_phone' then result := c.phone is not null and c.phone <> '';
    when 'replied' then
      result := exists (select 1 from public.messages m where m.contact_id = c.id and m.direction = 'inbound' and m.created_at >= since);
    when 'in_stage' then result := exists (select 1 from public.opportunities o where o.contact_id = c.id and o.stage_id::text = v);
    when 'in_pipeline' then result := exists (select 1 from public.opportunities o where o.contact_id = c.id and o.pipeline_id::text = v);
    when 'deal_status' then
      result := coalesce((select o.status from public.opportunities o where o.contact_id = c.id order by o.updated_at desc limit 1), '') = v;
    when 'deal_value' then
      select o.value_pence into num from public.opportunities o where o.contact_id = c.id order by o.updated_at desc limit 1;
      result := case
        when num is null or v !~ '^\d+(\.\d+)?$' then false
        when op = 'lt' then num < v::numeric * 100
        when op = 'is' then num = round(v::numeric * 100)
        else num > v::numeric * 100 end;
    when 'source_is' then
      if op = 'contains' then
        result := position(lower(trim(v)) in lower(coalesce(c.source, ''))) > 0;
      else
        result := lower(coalesce(c.source, '')) = lower(trim(v));
      end if;
    when 'has_owner' then result := c.owner_id is not null;
    when 'owner_is' then result := c.owner_id::text = v;
    when 'contact_field' then
      val := case k
        when 'first_name' then c.first_name
        when 'last_name' then c.last_name
        when 'email' then c.email
        when 'phone' then c.phone
        when 'source' then c.source
        else case when k like 'custom:%' then c.custom ->> substr(k, 8) end
      end;
      result := public.wf_compare(val, op, v);
    when 'day_of_week' then
      result := extract(isodow from local_now)::integer::text = any (string_to_array(v, ','));
    when 'time_of_day' then
      if v ~ '^\d{2}:\d{2}$' then
        result := case when op = 'gt' then local_now::time > v::time else local_now::time < v::time end;
      else
        result := false;
      end if;
    else
      result := false;
  end case;

  if coalesce((cond ->> 'negate')::boolean, false) then
    return not coalesce(result, false);
  end if;
  return coalesce(result, false);
end;
$$;
revoke execute on function public.wf_condition(jsonb, uuid, timestamptz) from public, anon, authenticated;

-- All conditions (AND) or any of them (OR). An empty list never matches.
create or replace function public.wf_match(conds jsonb, match text, target_contact uuid, since timestamptz) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  cnd jsonb;
  n integer := 0;
begin
  for cnd in select x from jsonb_array_elements(case when jsonb_typeof(conds) = 'array' then conds else '[]'::jsonb end) x loop
    n := n + 1;
    if public.wf_condition(cnd, target_contact, since) then
      if match = 'any' then
        return true;
      end if;
    elsif match <> 'any' then
      return false;
    end if;
  end loop;
  return n > 0 and match <> 'any';
end;
$$;
revoke execute on function public.wf_match(jsonb, text, uuid, timestamptz) from public, anon, authenticated;

-- Position of a step by id, for jumps. "end", a missing id or a backwards jump all mean the end.
create or replace function public.wf_step_index(steps jsonb, target text, current integer) returns integer
language sql immutable set search_path = '' as $$
  select coalesce(
    (select (t.ord - 1)::integer from jsonb_array_elements(steps) with ordinality as t(s, ord)
     where t.s ->> 'id' = target and target <> 'end' and (t.ord - 1) > current limit 1),
    jsonb_array_length(steps));
$$;
revoke execute on function public.wf_step_index(jsonb, text, integer) from public, anon, authenticated;

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
