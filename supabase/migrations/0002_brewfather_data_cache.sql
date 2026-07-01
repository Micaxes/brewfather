-- Per-user cache of normalized Brewfather data (rate-limit relief).
--
-- Brewfather allows 500 calls/hr per key; caching each user's inventory +
-- recipes lets repeated dashboard loads reuse a recent fetch. The blob is the
-- user's own (non-secret) data, so it lives in a plain table with owner-only RLS
-- (no Vault). The client still honors 429/Retry-After for the cold path.

create table if not exists public.brewfather_data_cache (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.brewfather_data_cache enable row level security;

drop policy if exists "own_cache_all" on public.brewfather_data_cache;
create policy "own_cache_all" on public.brewfather_data_cache
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.brewfather_data_cache to authenticated;
