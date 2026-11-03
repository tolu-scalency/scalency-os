-- Scalency OS: the database for the application journey (L1–L3 in docs/plans/automation-engine.md)
-- and the basics the automation engine needs. The plain-English guide is docs/database.md.
--
-- Every table belongs to an account (Scalency or a client). Composite foreign keys on
-- (id, account_id) stop a record in one account pointing at a record in another.
-- Row-level security means signed-in team members only see the accounts they belong to.
-- Public forms never write here directly: the app's server does, with the service key.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Accounts and who can see them
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone text not null default 'Europe/London',
  -- SMS only goes out inside this window, in the account's time zone (Automation Standards SOP).
  sms_window_start time not null default '08:00',
  sms_window_end time not null default '20:00',
  -- While on, messages go only to the test recipients below, never to real leads.
  test_mode boolean not null default true,
  test_email text,
  test_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sms_window_start < sms_window_end)
);

create table public.account_members (
  account_id uuid not null references public.accounts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create function public.is_account_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.account_members
    where account_id = target and user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Contacts, tags, custom fields and custom values
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  first_name text,
  last_name text,
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- International format with the country code, e.g. +447700900123 (WebinarJam SOP: no code, no SMS).
  phone text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  timezone text,
  email_consent_at timestamptz,
  sms_consent_at timestamptz,
  email_unsubscribed_at timestamptz,
  sms_unsubscribed_at timestamptz,
  source text,
  custom jsonb not null default '{}',
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id),
  check (email is not null or phone is not null)
);
create unique index contacts_account_email_key on public.contacts (account_id, lower(email)) where email is not null;
create index contacts_account_phone_idx on public.contacts (account_id, phone) where phone is not null;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (account_id, name),
  unique (id, account_id)
);

create table public.contact_tags (
  account_id uuid not null references public.accounts on delete cascade,
  contact_id uuid not null,
  tag_id uuid not null,
  added_at timestamptz not null default now(),
  primary key (contact_id, tag_id),
  foreign key (contact_id, account_id) references public.contacts (id, account_id) on delete cascade,
  foreign key (tag_id, account_id) references public.tags (id, account_id) on delete cascade
);

-- The extra questions each account asks. Answers live in the "custom" column of contacts or
-- opportunities, keyed by "key". Qualifying answers go on the opportunity (Custom Fields SOP).
create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  object text not null check (object in ('contact', 'opportunity')),
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  type text not null check (type in ('text', 'number', 'date', 'select', 'multi_select', 'yes_no', 'url')),
  options jsonb not null default '[]',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, object, key)
);

-- Dates, links, names and addresses used in messages, so nothing is typed into a message
-- (Automation Standards SOP). Used in templates as {{custom_values.key}}.
create table public.custom_values (
  account_id uuid not null references public.accounts on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (account_id, key)
);

-- ---------------------------------------------------------------------------
-- Pipelines and opportunities
-- ---------------------------------------------------------------------------

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (account_id, name),
  unique (id, account_id)
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  pipeline_id uuid not null,
  name text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  unique (pipeline_id, name),
  unique (id, pipeline_id),
  foreign key (pipeline_id, account_id) references public.pipelines (id, account_id) on delete cascade
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  contact_id uuid not null,
  pipeline_id uuid not null,
  stage_id uuid not null,
  -- The contact's name (Pipelines SOP).
  name text not null,
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'abandoned')),
  value_pence integer check (value_pence is null or value_pence >= 0),
  source text,
  custom jsonb not null default '{}',
  assigned_to uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, account_id),
  foreign key (contact_id, account_id) references public.contacts (id, account_id) on delete cascade,
  foreign key (pipeline_id, account_id) references public.pipelines (id, account_id),
  -- The stage must belong to the opportunity's own pipeline.
  foreign key (stage_id, pipeline_id) references public.pipeline_stages (id, pipeline_id)
);
create index opportunities_contact_idx on public.opportunities (contact_id);
create index opportunities_stage_idx on public.opportunities (stage_id);

-- ---------------------------------------------------------------------------
-- Application forms (VSL and Book-a-Call Funnel SOPs)
-- ---------------------------------------------------------------------------

-- "definition" holds the step 1 fields, the qualifying questions and the disqualifying rules,
-- so each client's form can differ without changing the database.
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  pipeline_id uuid,
  definition jsonb not null default '{}',
  qualified_url text,
  unqualified_url text,
  status text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, slug),
  unique (id, account_id),
  foreign key (pipeline_id, account_id) references public.pipelines (id, account_id)
);

-- One row per application. Created as soon as step 1 arrives ("started"), then updated
-- when the rest is answered ("qualified" or "unqualified").
create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  form_id uuid not null,
  contact_id uuid not null,
  opportunity_id uuid,
  status text not null default 'started' check (status in ('started', 'qualified', 'unqualified')),
  answers jsonb not null default '{}',
  disqualified_by text,
  -- Where they came from: page address, UTM tags, ad IDs.
  tracking jsonb not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (form_id, account_id) references public.forms (id, account_id) on delete cascade,
  foreign key (contact_id, account_id) references public.contacts (id, account_id) on delete cascade,
  foreign key (opportunity_id, account_id) references public.opportunities (id, account_id) on delete set null (opportunity_id),
  check ((status = 'started') = (completed_at is null)),
  check (status <> 'unqualified' or disqualified_by is not null)
);
create index form_submissions_form_idx on public.form_submissions (form_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Messages: templates and every email or SMS sent or received
-- ---------------------------------------------------------------------------

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name text not null,
  channel text not null check (channel in ('email', 'sms')),
  subject text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, name),
  unique (id, account_id),
  check (channel = 'sms' or subject is not null)
);

-- ---------------------------------------------------------------------------
-- Workflows: the automation engine
-- ---------------------------------------------------------------------------

-- "trigger" says what starts the workflow (e.g. {"type": "form_started", "form_id": "..."}).
-- "steps" is the list of named steps (send, wait, if/else, tag, move stage, notify ...).
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  name text not null,
  description text,
  trigger jsonb not null,
  steps jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  allow_re_entry boolean not null default true,
  client_approved_at timestamptz,
  client_approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, name),
  unique (id, account_id),
  -- Nothing goes live without the client's approval (Automation Standards SOP).
  check (status <> 'active' or client_approved_at is not null)
);

-- One row each time a contact goes through a workflow (GHL's "enrolment history").
create table public.workflow_enrollments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  workflow_id uuid not null,
  contact_id uuid not null,
  opportunity_id uuid,
  status text not null default 'active' check (status in ('active', 'waiting', 'completed', 'exited', 'failed')),
  current_step text,
  -- When the engine's clock should next pick this up.
  next_run_at timestamptz,
  -- What "wait until X before/after" is timed from (e.g. the appointment start).
  event_at timestamptz,
  context jsonb not null default '{}',
  exit_reason text,
  entered_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (id, account_id),
  foreign key (workflow_id, account_id) references public.workflows (id, account_id) on delete cascade,
  foreign key (contact_id, account_id) references public.contacts (id, account_id) on delete cascade,
  foreign key (opportunity_id, account_id) references public.opportunities (id, account_id) on delete set null (opportunity_id),
  check ((status in ('active', 'waiting')) = (finished_at is null)),
  check (status <> 'waiting' or next_run_at is not null)
);
-- A contact can only be in a workflow once at a time.
create unique index workflow_enrollments_live_key on public.workflow_enrollments (workflow_id, contact_id)
  where status in ('active', 'waiting');
-- The clock's to-do list.
create index workflow_enrollments_due_idx on public.workflow_enrollments (next_run_at)
  where status in ('active', 'waiting');
create index workflow_enrollments_contact_idx on public.workflow_enrollments (contact_id);

-- Every step the engine runs, for the execution log.
create table public.workflow_step_runs (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts on delete cascade,
  enrollment_id uuid not null,
  step_key text not null,
  action text not null,
  outcome text not null check (outcome in ('done', 'skipped', 'failed', 'waiting')),
  detail jsonb not null default '{}',
  ran_at timestamptz not null default now(),
  foreign key (enrollment_id, account_id) references public.workflow_enrollments (id, account_id) on delete cascade
);
create index workflow_step_runs_enrollment_idx on public.workflow_step_runs (enrollment_id, ran_at);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  contact_id uuid,
  enrollment_id uuid,
  template_id uuid,
  direction text not null check (direction in ('outbound', 'inbound')),
  channel text not null check (channel in ('email', 'sms')),
  to_address text not null,
  from_address text,
  subject text,
  body text not null,
  status text not null check (status in ('queued', 'sent', 'delivered', 'failed', 'received', 'held_test_mode')),
  provider text,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key (contact_id, account_id) references public.contacts (id, account_id) on delete set null (contact_id),
  foreign key (enrollment_id, account_id) references public.workflow_enrollments (id, account_id) on delete set null (enrollment_id),
  foreign key (template_id, account_id) references public.message_templates (id, account_id) on delete set null (template_id)
);
create index messages_contact_idx on public.messages (contact_id, created_at desc);
create unique index messages_provider_key on public.messages (provider, provider_message_id) where provider_message_id is not null;

-- ---------------------------------------------------------------------------
-- Activity log: a timeline per contact
-- ---------------------------------------------------------------------------

create table public.activity (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts on delete cascade,
  contact_id uuid,
  opportunity_id uuid,
  type text not null,
  summary text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (contact_id, account_id) references public.contacts (id, account_id) on delete cascade,
  foreign key (opportunity_id, account_id) references public.opportunities (id, account_id) on delete set null (opportunity_id)
);
create index activity_contact_idx on public.activity (contact_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at, row-level security and access
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'contacts', 'custom_fields', 'forms', 'message_templates', 'workflows', 'opportunities'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;

  -- Team members can read and change everything in their own accounts.
  foreach t in array array['contacts', 'tags', 'contact_tags', 'custom_fields', 'custom_values', 'pipelines',
                           'pipeline_stages', 'opportunities', 'forms', 'form_submissions', 'message_templates',
                           'workflows', 'workflow_enrollments', 'workflow_step_runs', 'messages', 'activity'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Members manage their accounts'' records" on public.%I for all to authenticated '
                   'using (public.is_account_member(account_id)) with check (public.is_account_member(account_id))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Accounts and memberships are created by the server, not from the browser.
alter table public.accounts enable row level security;
create policy "Members see their accounts" on public.accounts for select to authenticated
  using (public.is_account_member(id));
create policy "Members update their accounts" on public.accounts for update to authenticated
  using (public.is_account_member(id)) with check (public.is_account_member(id));
revoke all on public.accounts from anon;
grant select, update on public.accounts to authenticated;

alter table public.account_members enable row level security;
create policy "Members see who else is in their accounts" on public.account_members for select to authenticated
  using (public.is_account_member(account_id));
revoke all on public.account_members from anon;
grant select on public.account_members to authenticated;

revoke execute on function public.is_account_member(uuid) from public, anon;
grant execute on function public.is_account_member(uuid) to authenticated;
