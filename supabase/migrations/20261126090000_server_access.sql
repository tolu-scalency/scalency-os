-- Server access for public forms, embeds, webhooks and the workflow clock.
--
-- Newer Supabase projects no longer give the server role (service_role, used with
-- the secret key) access to new tables automatically. Without it, public form
-- links and embeds fail with "permission denied". This gives the server the
-- access it needs on everything in the public schema, now and for future tables.
-- The secret key only ever lives on the server, never in the browser.
-- Safe to run more than once.

do $$
begin
  grant usage on schema public to service_role;
  grant select, insert, update, delete on all tables in schema public to service_role;
  grant usage, select on all sequences in schema public to service_role;
  grant execute on all functions in schema public to service_role;
  alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
  alter default privileges in schema public grant usage, select on sequences to service_role;
  alter default privileges in schema public grant execute on functions to service_role;
exception when undefined_object then
  raise notice 'service_role not found here: %', sqlerrm;
end $$;

-- Check: should list the forms tables with yes in every column.
select table_name,
       has_table_privilege('service_role', 'public.' || table_name, 'select') as can_read,
       has_table_privilege('service_role', 'public.' || table_name, 'insert') as can_add,
       has_table_privilege('service_role', 'public.' || table_name, 'update') as can_change
from information_schema.tables
where table_schema = 'public' and table_name in ('forms', 'form_submissions', 'form_stats', 'form_uploads', 'contacts', 'accounts')
order by table_name;
