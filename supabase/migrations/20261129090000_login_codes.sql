-- A 6-digit code emailed after signing in with a password.
-- Only the app's server reads or writes these. The code itself is never stored,
-- only a hash of it. Safe to run more than once.

create table if not exists public.login_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Which sign-in this code is for (the session's sign-in time), so each new login needs a new code.
  session_at bigint not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists login_codes_user_idx on public.login_codes (user_id, created_at desc);

alter table public.login_codes enable row level security;
revoke all on public.login_codes from anon, authenticated;
grant select, insert, update, delete on public.login_codes to service_role;

-- Tidy up old codes now and then (called by the app's clock).
create or replace function public.prune_login_codes() returns void
language sql security definer set search_path = '' as $$
  delete from public.login_codes where created_at < now() - interval '2 days';
$$;
revoke execute on function public.prune_login_codes() from public, anon, authenticated;
grant execute on function public.prune_login_codes() to service_role;
