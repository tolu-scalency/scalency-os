-- SQL-24: people can see and change where a setter works (Scalency or GHL) and its booking page.
-- setter_agents uses column grants (so the GHL key stays hidden), so new columns need adding here.
grant select (engine, calendar_id) on public.setter_agents to authenticated;
grant update (engine, calendar_id) on public.setter_agents to authenticated;
notify pgrst, 'reload schema';
