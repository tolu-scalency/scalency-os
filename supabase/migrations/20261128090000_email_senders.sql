-- Workspaces send email from their own address.
--
-- Two ways, agreed with Tolu:
--   smtp   : their own mailbox (Google Workspace, Outlook, Zoho, their host) with its
--            SMTP settings. The password is encrypted by the app before it's saved here.
--   domain : their own domain, verified with our sending service (Resend), e.g.
--            hello@theirbusiness.co.uk. They add a few DNS records once.
-- Until a workspace connects one, email keeps going from Scalency's address.
--
-- People with "settings.manage" can see their workspace's senders, never the
-- encrypted password. All changes go through the app's server, which checks the
-- same permission. Safe to run more than once.

create table if not exists public.email_senders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null check (kind in ('smtp', 'domain')),
  from_name text not null default '',
  from_email text not null check (from_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  reply_to text check (reply_to is null or reply_to ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Mailbox (smtp) settings.
  smtp_host text,
  smtp_port integer check (smtp_port is null or smtp_port between 1 and 65535),
  smtp_security text check (smtp_security is null or smtp_security in ('ssl', 'starttls')),
  smtp_user text,
  smtp_secret text,
  -- Domain settings.
  domain text,
  provider_domain_id text,
  dns_records jsonb not null default '[]',
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  is_default boolean not null default false,
  last_error text,
  verified_at timestamptz,
  last_used_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'smtp' or (smtp_host is not null and smtp_port is not null and smtp_user is not null and smtp_secret is not null)),
  check (kind <> 'domain' or domain is not null)
);
create index if not exists email_senders_account_idx on public.email_senders (account_id);
-- One default sender per workspace.
create unique index if not exists email_senders_one_default on public.email_senders (account_id) where is_default;
-- The same domain can't be claimed by two workspaces.
create unique index if not exists email_senders_domain_key on public.email_senders (lower(domain)) where kind = 'domain';

drop trigger if exists set_updated_at on public.email_senders;
create trigger set_updated_at before update on public.email_senders for each row execute function public.set_updated_at();

alter table public.email_senders enable row level security;
drop policy if exists "Settings: see email senders" on public.email_senders;
create policy "Settings: see email senders" on public.email_senders for select to authenticated
  using (account_id in (select public.accounts_where_i_can('settings.manage')));

-- Browsers may read everything except the encrypted password, and change nothing.
revoke all on public.email_senders from anon, authenticated;
grant select (id, account_id, kind, from_name, from_email, reply_to, smtp_host, smtp_port, smtp_security, smtp_user,
              domain, provider_domain_id, dns_records, status, is_default, last_error, verified_at, last_used_at,
              created_by, created_at, updated_at)
  on public.email_senders to authenticated;
grant select, insert, update, delete on public.email_senders to service_role;

-- Which address sent each message.
alter table public.messages add column if not exists sender_id uuid references public.email_senders (id) on delete set null;
