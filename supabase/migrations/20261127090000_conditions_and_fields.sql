-- Workflow conditions and message fields, closer to GHL.
--
-- 1. member_directory: everyone in a workspace with a real name. Teammates who joined
--    by invite and never filled in a profile showed as "Teammate".
-- 2. render_template: more fields for messages: today's date, the latest deal
--    (name, value, stage, pipeline), tags and the contact's added date.
-- 3. wf_condition: new If / else checks: email or SMS unsubscribed, when the contact
--    was added, forms submitted, in or finished a workflow, reply text and channel,
--    open deals, deal owner, day of the month and a date.
-- Safe to run more than once.

-- 1. Names for everyone in a workspace ------------------------------------------------
create or replace function public.member_directory(target uuid)
returns table (user_id uuid, name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id,
         coalesce(nullif(trim(p.full_name), ''), nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(p.email, u.email, ''), '@', 1), 'Team member') as name,
         coalesce(p.email, u.email) as email
  from public.account_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  where m.account_id = target and public.is_account_member(target)
  order by 2;
$$;
revoke execute on function public.member_directory(uuid) from public, anon;
grant execute on function public.member_directory(uuid) to authenticated, service_role;

-- 2. Message fields ---------------------------------------------------------------
create or replace function public.render_template(body text, target_contact uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c record;
  acc record;
  owner record;
  deal record;
  out text := coalesce(body, '');
  k text;
  v text;
  j jsonb;
  t text;
  local_now timestamp;
begin
  select * into c from public.contacts where id = target_contact;
  if c.id is null then
    return out;
  end if;
  select name, timezone into acc from public.accounts where id = c.account_id;
  local_now := now() at time zone coalesce(acc.timezone, 'Europe/London');
  select coalesce(nullif(p.full_name, ''), u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)) as full_name,
         coalesce(p.email, u.email) as email, p.phone
    into owner
    from auth.users u left join public.profiles p on p.user_id = u.id
   where u.id = c.owner_id;

  out := replace(out, '{{first_name}}', coalesce(c.first_name, 'there'));
  out := replace(out, '{{last_name}}', coalesce(c.last_name, ''));
  out := replace(out, '{{name}}', trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')));
  out := replace(out, '{{email}}', coalesce(c.email, ''));
  out := replace(out, '{{phone}}', coalesce(c.phone, ''));
  out := replace(out, '{{source}}', coalesce(c.source, ''));
  out := replace(out, '{{workspace}}', coalesce(acc.name, ''));
  out := replace(out, '{{owner_name}}', coalesce(owner.full_name, ''));
  out := replace(out, '{{owner_first_name}}', coalesce(split_part(owner.full_name, ' ', 1), ''));
  out := replace(out, '{{owner_email}}', coalesce(owner.email, ''));
  out := replace(out, '{{owner_phone}}', coalesce(owner.phone, ''));
  out := replace(out, '{{added_date}}', to_char(c.created_at at time zone coalesce(acc.timezone, 'Europe/London'), 'FMDD Mon YYYY'));
  out := replace(out, '{{today}}', to_char(local_now, 'FMDD Mon YYYY'));
  out := replace(out, '{{weekday}}', to_char(local_now, 'FMDay'));
  out := replace(out, '{{year}}', to_char(local_now, 'YYYY'));

  if position('{{tags}}' in out) > 0 then
    out := replace(out, '{{tags}}', coalesce((
      select string_agg(tg.name, ', ' order by tg.name)
      from public.contact_tags ct join public.tags tg on tg.id = ct.tag_id
      where ct.contact_id = c.id), ''));
  end if;

  if position('{{deal_' in out) > 0 or position('{{pipeline}}' in out) > 0 then
    select o.name, o.value_pence, o.status, s.name as stage, pl.name as pipeline
      into deal
      from public.opportunities o
      left join public.pipeline_stages s on s.id = o.stage_id
      left join public.pipelines pl on pl.id = o.pipeline_id
     where o.contact_id = c.id
     order by o.updated_at desc
     limit 1;
    out := replace(out, '{{deal_name}}', coalesce(deal.name, ''));
    out := replace(out, '{{deal_value}}', case when deal.value_pence is null then '' else '£' || to_char(deal.value_pence / 100.0, 'FM999,999,990.00') end);
    out := replace(out, '{{deal_stage}}', coalesce(deal.stage, ''));
    out := replace(out, '{{deal_status}}', coalesce(deal.status, ''));
    out := replace(out, '{{pipeline}}', coalesce(deal.pipeline, ''));
  end if;

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

-- 3. If / else checks ---------------------------------------------------------------
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
  tz text;
  result boolean;
begin
  select * into c from public.contacts where id = target_contact;
  if c.id is null then
    return false;
  end if;
  select coalesce(a.timezone, 'Europe/London') into tz from public.accounts a where a.id = c.account_id;
  local_now := now() at time zone tz;

  case cond ->> 'field'
    when 'has_tag' then
      result := exists (
        select 1 from public.contact_tags ct join public.tags t on t.id = ct.tag_id
        where ct.contact_id = c.id and lower(t.name) = lower(trim(v)));
    when 'has_email' then result := c.email is not null and c.email <> '';
    when 'has_phone' then result := c.phone is not null and c.phone <> '';
    when 'email_unsubscribed' then result := c.email_unsubscribed_at is not null;
    when 'sms_unsubscribed' then result := c.sms_unsubscribed_at is not null;
    when 'contact_age' then
      -- Added more (gt) or fewer (lt) than v days ago.
      if v ~ '^\d{1,5}$' then
        result := case when op = 'lt' then c.created_at > now() - make_interval(days => v::integer)
                       else c.created_at <= now() - make_interval(days => v::integer) end;
      else
        result := false;
      end if;
    when 'replied' then
      result := exists (select 1 from public.messages m where m.contact_id = c.id and m.direction = 'inbound' and m.created_at >= since);
    when 'reply_contains' then
      result := exists (select 1 from public.messages m where m.contact_id = c.id and m.direction = 'inbound' and m.created_at >= since
                        and position(lower(trim(v)) in lower(m.body)) > 0);
    when 'reply_channel' then
      result := coalesce((select m.channel from public.messages m where m.contact_id = c.id and m.direction = 'inbound'
                          order by m.created_at desc limit 1), '') = v;
    when 'submitted_form' then
      result := exists (select 1 from public.form_submissions s where s.contact_id = c.id and s.form_id::text = v and s.status <> 'started');
    when 'in_workflow' then
      result := exists (select 1 from public.workflow_enrollments w where w.contact_id = c.id and w.workflow_id::text = v and w.status in ('active', 'waiting'));
    when 'finished_workflow' then
      result := exists (select 1 from public.workflow_enrollments w where w.contact_id = c.id and w.workflow_id::text = v and w.status = 'completed');
    when 'in_stage' then result := exists (select 1 from public.opportunities o where o.contact_id = c.id and o.stage_id::text = v);
    when 'in_pipeline' then result := exists (select 1 from public.opportunities o where o.contact_id = c.id and o.pipeline_id::text = v);
    when 'has_open_deal' then result := exists (select 1 from public.opportunities o where o.contact_id = c.id and o.status = 'open');
    when 'deal_status' then
      result := coalesce((select o.status from public.opportunities o where o.contact_id = c.id order by o.updated_at desc limit 1), '') = v;
    when 'deal_owner_is' then
      result := coalesce((select o.assigned_to::text from public.opportunities o where o.contact_id = c.id order by o.updated_at desc limit 1), '') = v;
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
    when 'day_of_month' then
      if v ~ '^\d{1,2}$' then
        result := case op
          when 'gt' then extract(day from local_now) > v::integer
          when 'lt' then extract(day from local_now) < v::integer
          else extract(day from local_now) = v::integer end;
      else
        result := false;
      end if;
    when 'date_is' then
      if v ~ '^\d{4}-\d{2}-\d{2}$' then
        result := case op
          when 'gt' then local_now::date > v::date
          when 'lt' then local_now::date < v::date
          else local_now::date = v::date end;
      else
        result := false;
      end if;
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
