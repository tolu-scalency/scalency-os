-- If / else: appointment checks
--   has_appointment     "Appointment booked": has a booking still to come (any booking page)
--   appointment_status  "Last appointment": booked, showed, no-show or cancelled
-- Replaces public.wf_condition with the same function plus these two checks.

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
    when 'has_appointment' then
      -- Has a booking still to come (booked or confirmed). value = a booking page id, or empty for any.
      result := exists (select 1 from public.appointments ap where ap.contact_id = c.id and ap.status in ('booked', 'confirmed')
                        and ap.starts_at > now() and (v = '' or v = 'any' or ap.calendar_id::text = v));
    when 'appointment_status' then
      -- Their most recent appointment's status: booked (booked or confirmed), showed, no_show or cancelled.
      result := coalesce((select case when ap.status = 'confirmed' then 'booked' else ap.status end
                          from public.appointments ap where ap.contact_id = c.id
                          order by ap.starts_at desc limit 1), '') = v;
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
