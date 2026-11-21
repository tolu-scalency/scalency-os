-- Funnels, websites, own domains, form folders and email replies.
--
-- Funnels      : a site of kind 'funnel' is pages in steps (site_pages.position).
--                page_stats.submissions counts forms sent from each step.
-- Websites     : a site of kind 'website'. Its shared header and footer are kept in
--                sites.settings (header, footer); site_pages.in_menu says which pages
--                show in the menu.
-- Own domains  : site_domains links a domain like www.theirbusiness.co.uk to a site.
--                It goes live once the TXT record proves they own it and the domain
--                points at Scalency. One domain can only belong to one site.
-- Form folders : forms.folder, a simple name ('' means no folder).
-- Email replies: email_senders keeps where its inbox was last read (IMAP).
-- Safe to run more than once.

-- Funnels and websites --------------------------------------------------------

alter table public.site_pages add column if not exists in_menu boolean not null default true;
alter table public.page_stats add column if not exists submissions integer not null default 0;

-- Counts a form sent from a page. The form and the page must be in the same workspace.
create or replace function public.count_page_submit(target_page uuid, target_account uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.page_stats (page_id, account_id, day, views, submissions)
  select p.id, p.account_id, current_date, 0, 1
  from public.site_pages p
  where p.id = target_page and p.account_id = target_account
  on conflict (page_id, day) do update set submissions = public.page_stats.submissions + 1;
$$;
revoke execute on function public.count_page_submit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.count_page_submit(uuid, uuid) to service_role;

-- Own domains -----------------------------------------------------------------

create table if not exists public.site_domains (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  site_id uuid not null,
  domain text not null check (domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$' and length(domain) <= 253),
  -- The value of the TXT record _scalency.<domain> that proves they own it.
  token text not null default replace(gen_random_uuid()::text, '-', ''),
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  -- Whether the domain was added to the Netlify site (so HTTPS works).
  hosting text not null default 'pending' check (hosting in ('pending', 'added', 'manual', 'failed')),
  last_error text,
  checked_at timestamptz,
  verified_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (site_id, account_id) references public.sites (id, account_id) on delete cascade
);
create unique index if not exists site_domains_domain_key on public.site_domains (domain);
create index if not exists site_domains_site_idx on public.site_domains (site_id);

drop trigger if exists set_updated_at on public.site_domains;
create trigger set_updated_at before update on public.site_domains for each row execute function public.set_updated_at();

alter table public.site_domains enable row level security;
drop policy if exists "Site domains: read" on public.site_domains;
create policy "Site domains: read" on public.site_domains for select to authenticated
  using (public.is_account_member(account_id));
-- Adding, checking and removing domains goes through the server, which also updates Netlify.
revoke all on public.site_domains from anon, authenticated;
grant select on public.site_domains to authenticated;
grant select, insert, update, delete on public.site_domains to service_role;

-- Form folders ----------------------------------------------------------------

alter table public.forms add column if not exists folder text not null default '' check (length(folder) <= 60);
create index if not exists forms_folder_idx on public.forms (account_id, folder);

-- Email replies (reading the connected mailbox) ---------------------------------

alter table public.email_senders add column if not exists imap_enabled boolean not null default true;
alter table public.email_senders add column if not exists imap_host text;
alter table public.email_senders add column if not exists imap_port integer check (imap_port is null or imap_port between 1 and 65535);
alter table public.email_senders add column if not exists imap_last_uid bigint;
alter table public.email_senders add column if not exists imap_uid_validity bigint;
alter table public.email_senders add column if not exists imap_checked_at timestamptz;
alter table public.email_senders add column if not exists imap_error text;
grant select (imap_enabled, imap_host, imap_port, imap_checked_at, imap_error) on public.email_senders to authenticated;
