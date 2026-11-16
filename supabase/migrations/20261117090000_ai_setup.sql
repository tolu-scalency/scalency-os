-- AI setup assistant.
--
-- A business describes itself (pasted text, an uploaded SOP or a voice note). The "ai-setup" edge
-- function asks Claude for a setup plan made only of Scalency's own building blocks and saves it here
-- as a draft. The person reviews and edits the plan, then apply_workspace_setup() builds it in one
-- transaction. undo_workspace_setup() removes what it created, as long as nothing has been used yet.

create table public.workspace_setups (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  created_by uuid references auth.users on delete set null default auth.uid(),
  source text not null default 'text' check (source in ('text', 'file', 'voice', 'mixed')),
  input_excerpt text check (input_excerpt is null or length(input_excerpt) <= 8000),
  blueprint jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'applied', 'undone')),
  result jsonb not null default '{}',
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  undone_at timestamptz
);
create index workspace_setups_account_idx on public.workspace_setups (account_id, created_at desc);

alter table public.workspace_setups enable row level security;
create policy "Members see their workspace setups" on public.workspace_setups for select to authenticated
  using (public.is_account_member(account_id));
-- Drafts are saved by the edge function acting as the signed-in person.
create policy "Members save draft setups" on public.workspace_setups for insert to authenticated
  with check (public.is_account_member(account_id) and created_by = (select auth.uid()) and status = 'draft');
revoke all on public.workspace_setups from anon;
grant select, insert on public.workspace_setups to authenticated;

-- Owners and admins only.
create function public.can_manage_account(target_account uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.account_members
    where account_id = target_account and user_id = (select auth.uid()) and role in ('owner', 'admin')
  );
$$;
revoke execute on function public.can_manage_account(uuid) from public, anon;
grant execute on function public.can_manage_account(uuid) to authenticated;

-- Builds a reviewed plan. The app has already checked the plan; this checks permission again and
-- keeps everything in one transaction, so a failure part-way leaves nothing behind.
--
-- plan = {
--   pipeline: { name, stages: [text], replace: bool } | null,
--   fields: [{ key, label }], tags: [text],
--   workflows: [{ name, description, trigger, steps }],
--   tasks: [{ title, due_in_days }], values: [{ key, value }]
-- }
create function public.apply_workspace_setup(target_setup uuid, plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  acc uuid;
  me uuid := (select auth.uid());
  existing uuid;
  pipe uuid;
  created_pipeline boolean := false;
  replaced boolean := false;
  stage_name text;
  i integer := 0;
  item jsonb;
  new_id uuid;
  field_ids uuid[] := '{}';
  tag_ids uuid[] := '{}';
  workflow_ids uuid[] := '{}';
  task_ids uuid[] := '{}';
  value_keys text[] := '{}';
  skipped text[] := '{}';
  outcome jsonb;
begin
  select * into s from public.workspace_setups where id = target_setup for update;
  if s.id is null then
    raise exception 'That setup no longer exists.';
  end if;
  acc := s.account_id;
  if not public.can_manage_account(acc) then
    raise exception 'Only the owner or an admin can set up the workspace.';
  end if;
  if s.status <> 'draft' then
    raise exception 'This setup has already been used.';
  end if;

  -- Pipeline: create one if there isn't one; replace the stages only when asked and no deals exist yet.
  if jsonb_typeof(plan -> 'pipeline') = 'object' and jsonb_array_length(coalesce(plan -> 'pipeline' -> 'stages', '[]')) >= 2 then
    select id into existing from public.pipelines where account_id = acc order by created_at limit 1;
    if existing is null then
      insert into public.pipelines (account_id, name)
      values (acc, left(coalesce(nullif(trim(plan -> 'pipeline' ->> 'name'), ''), 'Sales'), 60))
      returning id into pipe;
      created_pipeline := true;
    elsif coalesce((plan -> 'pipeline' ->> 'replace')::boolean, false) then
      if exists (select 1 from public.opportunities where pipeline_id = existing) then
        skipped := skipped || 'Kept your pipeline stages because deals are already in it'::text;
      else
        delete from public.pipeline_stages where pipeline_id = existing;
        update public.pipelines set name = left(coalesce(nullif(trim(plan -> 'pipeline' ->> 'name'), ''), name), 60) where id = existing;
        pipe := existing;
        replaced := true;
      end if;
    else
      skipped := skipped || 'Kept your existing pipeline'::text;
    end if;
    if pipe is not null then
      for stage_name in select left(trim(t.value), 60) from jsonb_array_elements_text(plan -> 'pipeline' -> 'stages') with ordinality as t(value, ord)
                        where trim(t.value) <> '' order by t.ord loop
        if not exists (select 1 from public.pipeline_stages where pipeline_id = pipe and lower(name) = lower(stage_name)) then
          i := i + 1;
          insert into public.pipeline_stages (account_id, pipeline_id, name, position) values (acc, pipe, stage_name, i);
        end if;
      end loop;
    end if;
  end if;

  -- Custom fields (new keys only).
  for item in select * from jsonb_array_elements(coalesce(plan -> 'fields', '[]')) loop
    new_id := null;
    insert into public.custom_fields (account_id, object, key, label, type, position)
    values (acc, 'contact', item ->> 'key', left(item ->> 'label', 60), 'text',
            (select count(*) from public.custom_fields where account_id = acc and object = 'contact'))
    on conflict (account_id, object, key) do nothing
    returning id into new_id;
    if new_id is not null then field_ids := field_ids || new_id; end if;
  end loop;

  -- Tags (new names only).
  for item in select * from jsonb_array_elements(coalesce(plan -> 'tags', '[]')) loop
    new_id := null;
    if not exists (select 1 from public.tags where account_id = acc and lower(name) = lower(trim(item #>> '{}'))) then
      insert into public.tags (account_id, name) values (acc, left(trim(item #>> '{}'), 40))
      on conflict (account_id, name) do nothing returning id into new_id;
      if new_id is not null then tag_ids := tag_ids || new_id; end if;
    end if;
  end loop;

  -- Workflows, always as drafts: someone has to approve and turn each one on.
  for item in select * from jsonb_array_elements(coalesce(plan -> 'workflows', '[]')) loop
    new_id := null;
    if exists (select 1 from public.workflows where account_id = acc and name = item ->> 'name') then
      skipped := skipped || ('You already have a workflow called ' || (item ->> 'name'));
    else
      insert into public.workflows (account_id, name, description, trigger, steps)
      values (acc, left(item ->> 'name', 80), left(item ->> 'description', 300), item -> 'trigger', coalesce(item -> 'steps', '[]'))
      returning id into new_id;
      workflow_ids := workflow_ids || new_id;
    end if;
  end loop;

  -- First tasks, for the person running the setup.
  for item in select * from jsonb_array_elements(coalesce(plan -> 'tasks', '[]')) loop
    insert into public.tasks (account_id, title, due_on, assigned_to, created_by)
    values (acc, left(item ->> 'title', 200), current_date + least(greatest(coalesce((item ->> 'due_in_days')::integer, 0), 0), 365), me, me)
    returning id into new_id;
    task_ids := task_ids || new_id;
  end loop;

  -- Custom values (new keys only, so nothing the business already set is overwritten).
  for item in select * from jsonb_array_elements(coalesce(plan -> 'values', '[]')) loop
    if not exists (select 1 from public.custom_values where account_id = acc and key = item ->> 'key') then
      insert into public.custom_values (account_id, key, value) values (acc, item ->> 'key', left(item ->> 'value', 1000));
      value_keys := value_keys || (item ->> 'key');
    end if;
  end loop;

  outcome := jsonb_build_object(
    'pipeline_id', pipe,
    'pipeline_created', created_pipeline,
    'stages_replaced', replaced,
    'stages', i,
    'field_ids', to_jsonb(field_ids),
    'tag_ids', to_jsonb(tag_ids),
    'workflow_ids', to_jsonb(workflow_ids),
    'task_ids', to_jsonb(task_ids),
    'value_keys', to_jsonb(value_keys),
    'skipped', to_jsonb(skipped)
  );

  update public.workspace_setups
  set status = 'applied', applied_at = now(), blueprint = blueprint || jsonb_build_object('applied_plan', plan), result = outcome
  where id = target_setup;

  insert into public.activity (account_id, type, summary)
  values (acc, 'workspace.setup', 'Workspace set up with AI');

  return outcome;
end;
$$;
revoke execute on function public.apply_workspace_setup(uuid, jsonb) from public, anon;
grant execute on function public.apply_workspace_setup(uuid, jsonb) to authenticated;

-- Takes back what a setup created, leaving anything that's already in use.
create function public.undo_workspace_setup(target_setup uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  r jsonb;
  kept text[] := '{}';
  removed integer := 0;
  n integer;
begin
  select * into s from public.workspace_setups where id = target_setup for update;
  if s.id is null then
    raise exception 'That setup no longer exists.';
  end if;
  if not public.can_manage_account(s.account_id) then
    raise exception 'Only the owner or an admin can undo a setup.';
  end if;
  if s.status <> 'applied' then
    raise exception 'There is nothing to undo.';
  end if;
  r := s.result;

  -- Workflows: only drafts nobody has been enrolled in.
  delete from public.workflows w
  where w.id in (select (jsonb_array_elements_text(coalesce(r -> 'workflow_ids', '[]')))::uuid)
    and w.account_id = s.account_id and w.status = 'draft'
    and not exists (select 1 from public.workflow_enrollments e where e.workflow_id = w.id);
  get diagnostics n = row_count; removed := removed + n;
  if n < jsonb_array_length(coalesce(r -> 'workflow_ids', '[]')) then
    kept := kept || 'Workflows that are on or have run'::text;
  end if;

  -- Tasks that aren't done yet.
  delete from public.tasks t
  where t.id in (select (jsonb_array_elements_text(coalesce(r -> 'task_ids', '[]')))::uuid)
    and t.account_id = s.account_id and t.done_at is null;
  get diagnostics n = row_count; removed := removed + n;

  -- Tags nobody has used.
  delete from public.tags g
  where g.id in (select (jsonb_array_elements_text(coalesce(r -> 'tag_ids', '[]')))::uuid)
    and g.account_id = s.account_id
    and not exists (select 1 from public.contact_tags ct where ct.tag_id = g.id);
  get diagnostics n = row_count; removed := removed + n;

  -- Custom fields.
  delete from public.custom_fields f
  where f.id in (select (jsonb_array_elements_text(coalesce(r -> 'field_ids', '[]')))::uuid)
    and f.account_id = s.account_id;
  get diagnostics n = row_count; removed := removed + n;

  -- Custom values.
  delete from public.custom_values v
  where v.account_id = s.account_id and v.key in (select jsonb_array_elements_text(coalesce(r -> 'value_keys', '[]')));
  get diagnostics n = row_count; removed := removed + n;

  -- The pipeline, if this setup created it and no deals are in it.
  if coalesce((r ->> 'pipeline_created')::boolean, false) then
    delete from public.pipelines p
    where p.id = (r ->> 'pipeline_id')::uuid and p.account_id = s.account_id
      and not exists (select 1 from public.opportunities o where o.pipeline_id = p.id);
    get diagnostics n = row_count; removed := removed + n;
    if n = 0 then kept := kept || 'The pipeline, because deals are in it'::text; end if;
  elsif coalesce((r ->> 'stages_replaced')::boolean, false) then
    kept := kept || 'Your pipeline stages (the old ones were replaced, rename them in Settings)'::text;
  end if;

  update public.workspace_setups set status = 'undone', undone_at = now() where id = target_setup;
  return jsonb_build_object('removed', removed, 'kept', to_jsonb(kept));
end;
$$;
revoke execute on function public.undo_workspace_setup(uuid) from public, anon;
grant execute on function public.undo_workspace_setup(uuid) to authenticated;
