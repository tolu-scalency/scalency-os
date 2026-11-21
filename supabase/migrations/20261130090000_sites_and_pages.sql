-- Pages, funnels and websites.
--
-- A "site" is what people build in Sites, Funnels and pages:
--   page    : one landing page
--   funnel  : pages in steps (opt-in, sales, thank you)        (coming next)
--   website : several pages with a shared menu and footer       (coming next)
-- Each site has one or more pages. A page's layout (sections, rows, columns and
-- blocks, plus its style, search and tracking settings) is in site_pages.definition.
--
-- Public address: os.scalency.us/p/<workspace>/<site link name>[/<page link name>]
-- People with "sites.manage" build them; anyone can view a live one.
-- Safe to run more than once.

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null default 'page' check (kind in ('page', 'funnel', 'website')),
  name text not null check (length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  status text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  settings jsonb not null default '{}',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, slug),
  unique (id, account_id)
);

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  site_id uuid not null,
  name text not null check (length(name) between 1 and 120),
  -- '' for the site's first page (its home), otherwise the page's link name.
  slug text not null default '' check (slug = '' or (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80)),
  position integer not null default 0,
  definition jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug),
  foreign key (site_id, account_id) references public.sites (id, account_id) on delete cascade
);
create index if not exists site_pages_site_idx on public.site_pages (site_id, position);

-- Views per page per day, counted by the server.
create table if not exists public.page_stats (
  page_id uuid not null references public.site_pages (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  day date not null default current_date,
  views integer not null default 0,
  primary key (page_id, day)
);

-- A form submitted from a page records which page it came from (tracking.page),
-- so pages can show conversions. Nothing to add for that here.

do $$
declare
  t text;
begin
  foreach t in array array['sites', 'site_pages'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

alter table public.sites enable row level security;
alter table public.site_pages enable row level security;
alter table public.page_stats enable row level security;

drop policy if exists "Sites: read" on public.sites;
drop policy if exists "Sites: manage" on public.sites;
create policy "Sites: read" on public.sites for select to authenticated
  using (public.is_account_member(account_id));
create policy "Sites: manage" on public.sites for all to authenticated
  using (account_id in (select public.accounts_where_i_can('sites.manage')))
  with check (account_id in (select public.accounts_where_i_can('sites.manage')));

drop policy if exists "Site pages: read" on public.site_pages;
drop policy if exists "Site pages: manage" on public.site_pages;
create policy "Site pages: read" on public.site_pages for select to authenticated
  using (public.is_account_member(account_id));
create policy "Site pages: manage" on public.site_pages for all to authenticated
  using (account_id in (select public.accounts_where_i_can('sites.manage')))
  with check (account_id in (select public.accounts_where_i_can('sites.manage')));

drop policy if exists "Page stats: read" on public.page_stats;
create policy "Page stats: read" on public.page_stats for select to authenticated
  using (public.is_account_member(account_id));

revoke all on public.sites, public.site_pages, public.page_stats from anon;
grant select, insert, update, delete on public.sites, public.site_pages to authenticated;
grant select on public.page_stats to authenticated;
grant select, insert, update, delete on public.sites, public.site_pages, public.page_stats to service_role;

create or replace function public.count_page_view(target_page uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.page_stats (page_id, account_id, day, views)
  select p.id, p.account_id, current_date, 1
  from public.site_pages p join public.sites s on s.id = p.site_id
  where p.id = target_page and s.status = 'live'
  on conflict (page_id, day) do update set views = public.page_stats.views + 1;
$$;
revoke execute on function public.count_page_view(uuid) from public, anon, authenticated;
grant execute on function public.count_page_view(uuid) to service_role;

-- Pictures for pages (public, so pages can show them). Uploads go through the
-- app's server, which checks access, size (5 MB) and type (JPG, PNG, WebP, GIF).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('page-media', 'page-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
    on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  end if;
end $$;
