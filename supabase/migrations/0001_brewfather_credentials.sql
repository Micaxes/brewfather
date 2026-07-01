-- Per-user Brewfather credentials (v1 multi-user).
--
-- The API key is stored encrypted at rest in Supabase Vault; this table keeps
-- only the (non-secret) Brewfather user id and a reference to the vault secret.
-- RLS restricts every row to its owner, and all writes go through SECURITY
-- DEFINER functions so the raw key only ever passes through vetted code paths.
--
-- Vault is enabled by default on Supabase projects (schema `vault`).

create table if not exists public.brewfather_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bf_user_id text not null,
  api_key_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brewfather_credentials enable row level security;

-- Owners may read their own row (to show connection status). All writes go
-- through the SECURITY DEFINER functions below, so no insert/update/delete
-- policy is granted to clients.
drop policy if exists "own_creds_select" on public.brewfather_credentials;
create policy "own_creds_select" on public.brewfather_credentials
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.brewfather_credentials to authenticated;

-- Store (or replace) the caller's Brewfather credentials. The API key goes into
-- Vault; only its secret id is stored in the table.
create or replace function public.store_brewfather_credentials(
  p_bf_user_id text,
  p_api_key text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing uuid;
  v_secret_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(trim(p_bf_user_id), '') = '' or coalesce(trim(p_api_key), '') = '' then
    raise exception 'bf_user_id and api_key are required';
  end if;

  select c.api_key_secret_id into v_existing
  from public.brewfather_credentials c
  where c.user_id = v_uid;

  if v_existing is not null then
    perform vault.update_secret(v_existing, p_api_key);
    update public.brewfather_credentials
      set bf_user_id = p_bf_user_id, updated_at = now()
      where user_id = v_uid;
  else
    v_secret_id := vault.create_secret(
      p_api_key,
      'bf_api_key_' || v_uid::text,
      'Brewfather API key'
    );
    insert into public.brewfather_credentials (user_id, bf_user_id, api_key_secret_id)
    values (v_uid, p_bf_user_id, v_secret_id);
  end if;
end;
$$;

-- Return the caller's decrypted Brewfather credentials. SECURITY DEFINER so it
-- can read vault.decrypted_secrets. Call SERVER-SIDE ONLY — the api key is
-- sensitive and must never be returned to the browser.
create or replace function public.get_brewfather_credentials()
returns table (bf_user_id text, api_key text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  return query
  select c.bf_user_id, ds.decrypted_secret::text
  from public.brewfather_credentials c
  join vault.decrypted_secrets ds on ds.id = c.api_key_secret_id
  where c.user_id = v_uid;
end;
$$;

-- Delete the caller's credentials (and their vault secret).
create or replace function public.delete_brewfather_credentials()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_secret_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select c.api_key_secret_id into v_secret_id
  from public.brewfather_credentials c
  where c.user_id = v_uid;
  if v_secret_id is not null then
    delete from vault.secrets where id = v_secret_id;
  end if;
  delete from public.brewfather_credentials where user_id = v_uid;
end;
$$;

revoke all on function public.store_brewfather_credentials(text, text) from public;
revoke all on function public.get_brewfather_credentials() from public;
revoke all on function public.delete_brewfather_credentials() from public;
grant execute on function public.store_brewfather_credentials(text, text) to authenticated;
grant execute on function public.get_brewfather_credentials() to authenticated;
grant execute on function public.delete_brewfather_credentials() to authenticated;
