-- More permissions, ready for features that are coming (calendars, payments,
-- marketing, sites, AI and reporting). Roles can switch them on now, and each
-- feature checks its permission when it goes live.

create or replace function public.all_permissions() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'contacts.view_all', 'contacts.edit', 'contacts.delete',
    'deals.edit', 'pipeline.manage',
    'inbox.send',
    'workflows.manage',
    'calendars.manage',   -- calendars, booking pages and appointments
    'payments.manage',    -- invoices, products, subscriptions and refunds
    'marketing.manage',   -- campaigns, social planner, templates
    'sites.manage',       -- funnels, websites, forms and surveys
    'ai.manage',          -- AI agents, voice receptionist, creative studio
    'reporting.view',     -- dashboards and reports
    'settings.manage', 'team.manage'
  ]::text[];
$$;

create or replace function public.default_member_permissions() returns text[]
language sql immutable set search_path = '' as $$
  select array['contacts.view_all', 'contacts.edit', 'contacts.delete', 'deals.edit', 'pipeline.manage', 'inbox.send', 'workflows.manage',
               'calendars.manage', 'marketing.manage', 'sites.manage', 'reporting.view']::text[];
$$;

-- Give the starter roles sensible access to the new areas (only where they haven't been changed).
update public.account_roles
set permissions = permissions || array['calendars.manage', 'marketing.manage', 'sites.manage', 'reporting.view']
where name = 'Team member'
  and permissions @> array['contacts.view_all', 'contacts.edit', 'contacts.delete', 'deals.edit', 'pipeline.manage', 'inbox.send', 'workflows.manage']
  and not permissions && array['calendars.manage', 'marketing.manage', 'sites.manage', 'reporting.view'];

update public.account_roles
set permissions = permissions || array['calendars.manage']
where name = 'Sales rep' and permissions = array['contacts.edit', 'deals.edit', 'inbox.send'];

update public.account_roles
set permissions = permissions || array['reporting.view']
where name = 'Viewer' and permissions = array['contacts.view_all'];

create or replace function public.add_starter_roles(target uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.account_roles (account_id, name, description, permissions) values
    (target, 'Team member', 'Works on every contact and deal, but can''t change settings or the team.',
      array['contacts.view_all', 'contacts.edit', 'contacts.delete', 'deals.edit', 'pipeline.manage', 'inbox.send', 'workflows.manage',
            'calendars.manage', 'marketing.manage', 'sites.manage', 'reporting.view']),
    (target, 'Sales rep', 'Sees only the contacts they own. Can add contacts, move deals, book calls and send messages.',
      array['contacts.edit', 'deals.edit', 'inbox.send', 'calendars.manage']),
    (target, 'Viewer', 'Can look at every contact, deal and report but can''t change anything.',
      array['contacts.view_all', 'reporting.view'])
  on conflict do nothing;
$$;
revoke execute on function public.add_starter_roles(uuid) from public, anon, authenticated;
