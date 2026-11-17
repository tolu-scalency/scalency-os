-- Pipelines upgrade: several pipelines per workspace, ordered; deals keep a
-- reason when lost; and a safe way to delete a pipeline.

alter table public.pipelines add column if not exists position integer not null default 0;
update public.pipelines p set position = sub.n
from (select id, row_number() over (partition by account_id order by created_at) as n from public.pipelines) sub
where sub.id = p.id and p.position = 0;

alter table public.opportunities add column if not exists lost_reason text check (char_length(lost_reason) <= 200);

create index if not exists opportunities_pipeline_status_idx on public.opportunities (pipeline_id, status, updated_at desc);
create index if not exists opportunities_assigned_idx on public.opportunities (account_id, assigned_to);

-- Deletes a pipeline only when it has no deals, so nothing is lost by accident.
create or replace function public.delete_pipeline(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  acc uuid;
begin
  select account_id into acc from public.pipelines where id = target;
  if acc is null then
    raise exception 'That pipeline no longer exists.';
  end if;
  if not public.has_permission(acc, 'pipeline.manage') then
    raise exception 'You don''t have access to change pipelines.';
  end if;
  if exists (select 1 from public.opportunities where pipeline_id = target) then
    raise exception 'Move or delete its deals first.';
  end if;
  if (select count(*) from public.pipelines where account_id = acc) <= 1 then
    raise exception 'A workspace needs at least one pipeline.';
  end if;
  delete from public.pipeline_stages where pipeline_id = target;
  delete from public.pipelines where id = target;
end;
$$;
revoke execute on function public.delete_pipeline(uuid) from public, anon;
grant execute on function public.delete_pipeline(uuid) to authenticated;
