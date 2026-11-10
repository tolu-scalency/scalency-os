-- Scalency OS: more than one workspace per person, the workflow engine, and team chat.
-- The plain-English guide is docs/database.md ("Workspaces, workflows and chat").

-- ---------------------------------------------------------------------------
-- 1. Workspaces (like GoHighLevel sub-accounts)
-- ---------------------------------------------------------------------------

-- Creates another workspace for the signed-in person, with them as owner.
create function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_email text;
  new_account uuid;
  base_slug text;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  workspace_name := trim(coalesce(workspace_name, ''));
  if length(workspace_name) < 2 or length(workspace_name) > 80 then
    raise exception 'The workspace name must be 2 to 80 characters.';
  end if;
  if (select count(*) from public.account_members where user_id = me and role = 'owner') >= 25 then
    raise exception 'You can own up to 25 workspaces.';
  end if;

  select email into my_email from auth.users where id = me;
  base_slug := trim(both '-' from regexp_replace(lower(workspace_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then
    base_slug := 'workspace';
  end if;
  base_slug := trim(both '-' from left(base_slug, 40)) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);

  insert into public.accounts (name, slug, test_mode, test_email)
  values (workspace_name, base_slug, true, my_email)
  returning id into new_account;
  insert into public.account_members (account_id, user_id, role) values (new_account, me, 'owner');
  return new_account;
end;
$$;
revoke execute on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;

-- Invites waiting for the signed-in person, with the workspace name.
create function public.my_pending_invites()
returns table (invite_id uuid, account_name text, role text, invited_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, a.name, i.role, i.created_at
  from public.account_invites i
  join public.accounts a on a.id = i.account_id
  where i.accepted_at is null
    and lower(i.email) = (select lower(email) from auth.users where id = (select auth.uid()))
  order by i.created_at desc;
$$;
revoke execute on function public.my_pending_invites() from public, anon;
grant execute on function public.my_pending_invites() to authenticated;

-- Accepts one invite addressed to the signed-in person. Returns the workspace id.
create function public.accept_invite(target_invite uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  invite record;
begin
  select i.* into invite from public.account_invites i
  where i.id = target_invite and i.accepted_at is null
    and lower(i.email) = (select lower(email) from auth.users where id = me);
  if invite.id is null then
    raise exception 'That invite is no longer available.';
  end if;
  insert into public.account_members (account_id, user_id, role)
  values (invite.account_id, me, invite.role)
  on conflict (account_id, user_id) do nothing;
  update public.account_invites set accepted_at = now() where id = invite.id;
  return invite.account_id;
end;
$$;
revoke execute on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Team chat
-- ---------------------------------------------------------------------------

create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name text not null check (name ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  topic text check (topic is null or length(topic) <= 200),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (account_id, name),
  unique (id, account_id)
);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts on delete cascade,
  channel_id uuid not null,
  -- Empty for messages posted by Scalency itself (e.g. lead alerts from a workflow).
  author_id uuid references auth.users on delete set null,
  body text not null check (length(trim(body)) between 1 and 4000),
  contact_id uuid,
  created_at timestamptz not null default now(),
  foreign key (channel_id, account_id) references public.chat_channels (id, account_id) on delete cascade
);
create index chat_messages_channel_idx on public.chat_messages (channel_id, created_at desc);

alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;
create policy "Members manage their accounts' records" on public.chat_channels for all to authenticated
  using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));
create policy "Members read their accounts' messages" on public.chat_messages for select to authenticated
  using (public.is_account_member(account_id));
create policy "Members post as themselves" on public.chat_messages for insert to authenticated
  with check (public.is_account_member(account_id) and author_id = (select auth.uid()));
create policy "People delete their own messages" on public.chat_messages for delete to authenticated
  using (author_id = (select auth.uid()));
revoke all on public.chat_channels, public.chat_messages from anon;
grant select, insert, update, delete on public.chat_channels to authenticated;
grant select, insert, delete on public.chat_messages to authenticated;

-- Live updates in the app (Supabase Realtime). Skipped where Realtime isn't installed.
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when others then
  raise notice 'Realtime not available here: %', sqlerrm;
end $$;

-- Finds or creates a channel by name (used by workflows to post lead alerts).
create function public.chat_channel_for(target_account uuid, channel_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  found uuid;
begin
  select id into found from public.chat_channels where account_id = target_account and name = channel_name;
  if found is null then
    insert into public.chat_channels (account_id, name, topic)
    values (target_account, channel_name, case channel_name when 'leads' then 'New leads and bookings, posted automatically.' else null end)
    on conflict (account_id, name) do nothing
    returning id into found;
    if found is null then
      select id into found from public.chat_channels where account_id = target_account and name = channel_name;
    end if;
  end if;
  return found;
end;
$$;
revoke execute on function public.chat_channel_for(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The workflow engine
-- ---------------------------------------------------------------------------
-- A workflow has a trigger and a list of steps (see docs/database.md for the format).
-- When the trigger happens the contact is enrolled. Every minute, run_due_workflows()
-- runs the steps that are due, stopping at each "wait" until its time comes.

alter table public.workflows add constraint workflows_trigger_shape check (jsonb_typeof(trigger) = 'object' and trigger ? 'type');
alter table public.workflows add constraint workflows_steps_shape check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 50);

-- Puts a contact into a workflow, unless they're already in it.
create function public.enroll_contact(target_workflow uuid, target_contact uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  wf record;
  opp uuid;
  new_id uuid;
begin
  select * into wf from public.workflows where id = target_workflow;
  if wf.id is null then
    return null;
  end if;
  if (select auth.uid()) is not null and not public.is_account_member(wf.account_id) then
    raise exception 'Not allowed.';
  end if;
  if jsonb_array_length(wf.steps) = 0 then
    return null;
  end if;
  if not wf.allow_re_entry and exists (select 1 from public.workflow_enrollments where workflow_id = wf.id and contact_id = target_contact) then
    return null;
  end if;
  select id into opp from public.opportunities where contact_id = target_contact order by updated_at desc limit 1;

  insert into public.workflow_enrollments (account_id, workflow_id, contact_id, opportunity_id, status, current_step, next_run_at)
  values (wf.account_id, wf.id, target_contact, opp, 'active', '0', now())
  on conflict (workflow_id, contact_id) where status in ('active', 'waiting') do nothing
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.enroll_contact(uuid, uuid) from public, anon;
grant execute on function public.enroll_contact(uuid, uuid) to authenticated;

-- Fills in {{first_name}}, {{last_name}}, {{name}}, {{email}}, {{phone}} and {{workspace}}.
create function public.render_template(body text, target_contact uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select replace(replace(replace(replace(replace(replace(coalesce(body, ''),
    '{{first_name}}', coalesce(c.first_name, 'there')),
    '{{last_name}}', coalesce(c.last_name, '')),
    '{{name}}', trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))),
    '{{email}}', coalesce(c.email, '')),
    '{{phone}}', coalesce(c.phone, '')),
    '{{workspace}}', a.name)
  from public.contacts c join public.accounts a on a.id = c.account_id
  where c.id = target_contact;
$$;
revoke execute on function public.render_template(text, uuid) from public, anon, authenticated;

-- Runs every step that's due. Safe to run twice at once: each enrolment is locked while it runs.
-- If target_account is given, only that workspace is processed.
create function public.run_due_workflows(target_account uuid default null)
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
  idx integer;
  total integer;
  processed integer := 0;
  guard integer;
  outcome text;
  info jsonb;
  addr text;
  wait_for interval;
  stage record;
  opp uuid;
  channel uuid;
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
      select * into c from public.contacts where id = e.contact_id;
      outcome := 'done';
      info := '{}';

      case step ->> 'type'
        when 'wait' then
          wait_for := make_interval(
            mins => case step ->> 'unit' when 'minutes' then greatest(coalesce((step ->> 'amount')::integer, 0), 0) else 0 end,
            hours => case step ->> 'unit' when 'hours' then greatest(coalesce((step ->> 'amount')::integer, 0), 0) else 0 end,
            days => case step ->> 'unit' when 'days' then greatest(coalesce((step ->> 'amount')::integer, 0), 0) else 0 end);
          insert into public.workflow_step_runs (account_id, enrollment_id, step_key, action, outcome, detail)
          values (e.account_id, e.id, idx::text, 'wait', 'waiting', jsonb_build_object('until', now() + wait_for));
          update public.workflow_enrollments set status = 'waiting', current_step = (idx + 1)::text, next_run_at = now() + wait_for where id = e.id;
          exit steps;

        when 'email', 'sms' then
          addr := case when step ->> 'type' = 'email'
                    then case when acc.test_mode then acc.test_email else c.email end
                    else case when acc.test_mode then acc.test_phone else c.phone end end;
          if addr is null or addr = '' then
            outcome := 'skipped';
            info := jsonb_build_object('reason', case when acc.test_mode then 'No test ' || (step ->> 'type') || ' set for this workspace' else 'Contact has no ' || (step ->> 'type') end);
          else
            insert into public.messages (account_id, contact_id, enrollment_id, direction, channel, to_address, subject, body, status)
            values (e.account_id, e.contact_id, e.id, 'outbound', step ->> 'type', addr,
                    case when step ->> 'type' = 'email' then public.render_template(step ->> 'subject', e.contact_id) end,
                    public.render_template(step ->> 'body', e.contact_id),
                    case when acc.test_mode then 'held_test_mode' else 'queued' end);
            insert into public.activity (account_id, contact_id, type, summary)
            values (e.account_id, e.contact_id, 'message.' || (step ->> 'type'),
                    case when step ->> 'type' = 'email' then 'Email: ' || coalesce(public.render_template(step ->> 'subject', e.contact_id), '') else 'Text: ' || left(public.render_template(step ->> 'body', e.contact_id), 80) end
                    || case when acc.test_mode then ' (test mode)' else '' end);
            info := jsonb_build_object('to', addr, 'test_mode', acc.test_mode);
          end if;

        when 'task' then
          insert into public.tasks (account_id, title, due_on, contact_id)
          values (e.account_id, left(public.render_template(coalesce(step ->> 'title', 'Follow up'), e.contact_id), 200),
                  current_date + greatest(coalesce((step ->> 'due_in_days')::integer, 0), 0), e.contact_id);

        when 'move_stage' then
          select * into stage from public.pipeline_stages where id = nullif(step ->> 'stage_id', '')::uuid and account_id = e.account_id;
          if stage.id is null then
            outcome := 'skipped';
            info := jsonb_build_object('reason', 'Stage no longer exists');
          else
            select id into opp from public.opportunities where contact_id = e.contact_id order by updated_at desc limit 1;
            if opp is null then
              insert into public.opportunities (account_id, contact_id, pipeline_id, stage_id, name, source)
              values (e.account_id, e.contact_id, stage.pipeline_id, stage.id, trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), 'workflow');
            else
              update public.opportunities set stage_id = stage.id, pipeline_id = stage.pipeline_id where id = opp and stage_id <> stage.id;
            end if;
            insert into public.activity (account_id, contact_id, type, summary) values (e.account_id, e.contact_id, 'stage.changed', 'Moved to ' || stage.name || ' by a workflow');
          end if;

        when 'note' then
          insert into public.activity (account_id, contact_id, type, summary, detail)
          values (e.account_id, e.contact_id, 'note', public.render_template(coalesce(step ->> 'text', ''), e.contact_id), jsonb_build_object('author', wf.name));

        when 'notify_team' then
          channel := public.chat_channel_for(e.account_id, 'leads');
          insert into public.chat_messages (account_id, channel_id, author_id, body, contact_id)
          values (e.account_id, channel, null, public.render_template(coalesce(nullif(step ->> 'text', ''), 'New lead: {{name}}'), e.contact_id), e.contact_id);

        else
          outcome := 'skipped';
          info := jsonb_build_object('reason', 'Unknown step');
      end case;

      insert into public.workflow_step_runs (account_id, enrollment_id, step_key, action, outcome, detail)
      values (e.account_id, e.id, idx::text, coalesce(step ->> 'type', 'unknown'), outcome, info);
      idx := idx + 1;
      update public.workflow_enrollments set status = 'active', current_step = idx::text, next_run_at = now() where id = e.id;
    end loop steps;
  end loop;

  return processed;
end;
$$;
revoke execute on function public.run_due_workflows(uuid) from public, anon;
grant execute on function public.run_due_workflows(uuid) to authenticated;

-- Triggers: a new contact, or a contact entering a stage, enrols them in matching active workflows.
create function public.workflows_on_contact_created() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
begin
  for wf in select id from public.workflows where account_id = new.account_id and status = 'active' and trigger ->> 'type' = 'contact_created' loop
    perform public.enroll_contact(wf.id, new.id);
  end loop;
  return new;
end;
$$;
create trigger workflows_on_contact_created after insert on public.contacts
  for each row execute function public.workflows_on_contact_created();

create function public.workflows_on_stage_entered() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wf record;
begin
  if tg_op = 'UPDATE' and new.stage_id is not distinct from old.stage_id then
    return new;
  end if;
  for wf in select id from public.workflows where account_id = new.account_id and status = 'active'
    and trigger ->> 'type' = 'stage_entered' and trigger ->> 'stage_id' = new.stage_id::text loop
    perform public.enroll_contact(wf.id, new.contact_id);
  end loop;
  return new;
end;
$$;
create trigger workflows_on_stage_entered after insert or update of stage_id on public.opportunities
  for each row execute function public.workflows_on_stage_entered();

-- The clock: Supabase Cron runs the engine every minute. Skipped where pg_cron isn't installed.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('scalency-run-workflows', '* * * * *', 'select public.run_due_workflows()');
exception when others then
  raise notice 'pg_cron not available here: %', sqlerrm;
end $$;
