-- Email designer, merge fields and custom fields.
--
-- Emails from workflows can now carry a designed HTML version (messages.html).
-- Messages can use custom fields ({{contact.key}}), custom values ({{custom_values.key}})
-- and the owner's details ({{owner_name}}, {{owner_first_name}}, {{owner_email}}, {{owner_phone}}).
-- New steps: update a contact field, and email the team (internal notification).

alter table public.messages add column html text check (html is null or length(html) <= 200000);

-- Fills in every merge field. Unknown custom keys become blank.
create or replace function public.render_template(body text, target_contact uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c record;
  acc_name text;
  owner record;
  out text := coalesce(body, '');
  k text;
  v text;
begin
  select * into c from public.contacts where id = target_contact;
  if c.id is null then
    return out;
  end if;
  select name into acc_name from public.accounts where id = c.account_id;
  select p.full_name, p.email, p.phone into owner from public.profiles p where p.user_id = c.owner_id;

  out := replace(out, '{{first_name}}', coalesce(c.first_name, 'there'));
  out := replace(out, '{{last_name}}', coalesce(c.last_name, ''));
  out := replace(out, '{{name}}', trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')));
  out := replace(out, '{{email}}', coalesce(c.email, ''));
  out := replace(out, '{{phone}}', coalesce(c.phone, ''));
  out := replace(out, '{{source}}', coalesce(c.source, ''));
  out := replace(out, '{{workspace}}', coalesce(acc_name, ''));
  out := replace(out, '{{owner_name}}', coalesce(owner.full_name, ''));
  out := replace(out, '{{owner_first_name}}', coalesce(split_part(owner.full_name, ' ', 1), ''));
  out := replace(out, '{{owner_email}}', coalesce(owner.email, ''));
  out := replace(out, '{{owner_phone}}', coalesce(owner.phone, ''));

  if position('{{contact.' in out) > 0 then
    for k, v in select key, value #>> '{}' from jsonb_each(c.custom) loop
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
  return out;
end;
$$;
revoke execute on function public.render_template(text, uuid) from public, anon, authenticated;

-- Lets the app show a preview of a message with a contact's details filled in.
create function public.preview_template(body text, target_contact uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.contacts where id = target_contact and public.is_account_member(account_id)) then
    raise exception 'Not allowed.';
  end if;
  return public.render_template(body, target_contact);
end;
$$;
revoke execute on function public.preview_template(text, uuid) from public, anon;
grant execute on function public.preview_template(text, uuid) to authenticated;

-- The engine, now with designed emails, "update a field" and "email the team".
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

do $$
begin
  grant execute on function public.run_due_workflows(uuid) to service_role;
exception when undefined_object then
  raise notice 'service_role not found here: %', sqlerrm;
end $$;
