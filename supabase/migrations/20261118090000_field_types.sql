-- Field types for custom fields.
--
-- custom_fields already had a type column; until now the app only made text
-- fields. This adds money, long text, email and phone, keeps dropdown options
-- tidy, stores typed values (numbers as numbers, yes/no as true/false, multi
-- choice as a list) and shows them nicely in messages.

-- 1. Allowed types.
alter table public.custom_fields drop constraint if exists custom_fields_type_check;
alter table public.custom_fields add constraint custom_fields_type_check
  check (type in ('text', 'long_text', 'number', 'money', 'date', 'select', 'multi_select', 'yes_no', 'url', 'email', 'phone'));

-- 2. Dropdown options: a list of up to 50 short, unique, non-empty labels.
create or replace function public.clean_field_options(raw jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(label order by first_pos), '[]'::jsonb)
  from (
    select (array_agg(o order by pos))[1] as label, min(pos) as first_pos
    from (
      select left(trim(e.value #>> '{}'), 60) as o, e.ordinality as pos
      from jsonb_array_elements(case when jsonb_typeof(raw) = 'array' then raw else '[]'::jsonb end) with ordinality as e(value, ordinality)
      where jsonb_typeof(e.value) = 'string'
    ) t
    where o <> ''
    group by lower(o)
    order by min(pos)
    limit 50
  ) u;
$$;

alter table public.custom_fields drop constraint if exists custom_fields_options_check;
alter table public.custom_fields add constraint custom_fields_options_check
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 50);

-- 3. Turns one value into the right shape for its field type.
--    Anything that can't be read is kept as plain text, so nothing is lost.
create or replace function public.coerce_field_value(field_type text, val jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  s text;
begin
  if val is null or val = 'null'::jsonb then
    return null;
  end if;
  s := trim(val #>> '{}');
  case field_type
    when 'number', 'money' then
      if jsonb_typeof(val) = 'number' then return val; end if;
      s := replace(replace(replace(replace(s, ',', ''), '£', ''), '$', ''), '€', '');
      if s ~ '^-?[0-9]+(\.[0-9]+)?$' then return to_jsonb(s::numeric); end if;
    when 'yes_no' then
      if jsonb_typeof(val) = 'boolean' then return val; end if;
      if lower(s) in ('yes', 'y', 'true', '1', 'on') then return 'true'::jsonb; end if;
      if lower(s) in ('no', 'n', 'false', '0', 'off') then return 'false'::jsonb; end if;
    when 'multi_select' then
      if jsonb_typeof(val) = 'array' then return val; end if;
      return coalesce((select jsonb_agg(trim(x)) from unnest(string_to_array(s, ',')) as x where trim(x) <> ''), '[]'::jsonb);
    when 'date' then
      if s ~ '^\d{4}-\d{2}-\d{2}$' then return to_jsonb(s); end if;
      begin
        return to_jsonb(to_char(s::date, 'YYYY-MM-DD'));
      exception when others then
        null;
      end;
    else
      null;
  end case;
  return val;
end;
$$;

-- 4. Every write to contacts.custom (the app, workflows, imports) is shaped by field type.
create or replace function public.shape_contact_custom() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  f record;
  shaped jsonb;
begin
  if new.custom is null or new.custom = '{}'::jsonb then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.custom is not distinct from old.custom then
    return new;
  end if;
  for f in
    select cf.key, cf.type from public.custom_fields cf
    where cf.account_id = new.account_id and cf.object = 'contact' and new.custom ? cf.key
      and cf.type in ('number', 'money', 'yes_no', 'multi_select', 'date')
  loop
    shaped := public.coerce_field_value(f.type, new.custom -> f.key);
    if shaped is null then
      new.custom := new.custom - f.key;
    else
      new.custom := jsonb_set(new.custom, array[f.key], shaped);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists contacts_shape_custom on public.contacts;
create trigger contacts_shape_custom before insert or update of custom on public.contacts
  for each row execute function public.shape_contact_custom();

-- 5. Messages show typed values nicely: lists as "a, b", yes/no as Yes/No,
--    dates as 17 Nov 2026, money with two decimals.
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
  j jsonb;
  t text;
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
    for k, j, t in
      select e.key, e.value, cf.type
      from jsonb_each(c.custom) e
      left join public.custom_fields cf on cf.account_id = c.account_id and cf.object = 'contact' and cf.key = e.key
    loop
      v := case
        when jsonb_typeof(j) = 'array' then (select string_agg(x, ', ') from jsonb_array_elements_text(j) x)
        when jsonb_typeof(j) = 'boolean' then case when j = 'true'::jsonb then 'Yes' else 'No' end
        when t = 'money' and jsonb_typeof(j) = 'number' then to_char((j #>> '{}')::numeric, 'FM999,999,999,990.00')
        when t = 'date' and (j #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$' then to_char((j #>> '{}')::date, 'FMDD Mon YYYY')
        else j #>> '{}'
      end;
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

-- 6. The AI setup assistant can now create typed fields with dropdown options.
create or replace function public.apply_workspace_setup(target_setup uuid, plan jsonb)
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
    insert into public.custom_fields (account_id, object, key, label, type, options, position)
    values (acc, 'contact', item ->> 'key', left(item ->> 'label', 60),
            case when item ->> 'type' in ('text', 'long_text', 'number', 'money', 'date', 'select', 'multi_select', 'yes_no', 'url', 'email', 'phone')
                 then item ->> 'type' else 'text' end,
            case when item ->> 'type' in ('select', 'multi_select') and jsonb_typeof(item -> 'options') = 'array'
                 then public.clean_field_options(item -> 'options') else '[]'::jsonb end,
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

-- 7. Shape values that are already saved.
update public.contacts set custom = custom where custom <> '{}'::jsonb;
