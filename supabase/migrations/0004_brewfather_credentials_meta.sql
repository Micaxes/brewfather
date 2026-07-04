-- BYOK polish (#23): connection-health metadata.
--
-- `last_validated_at` records the last time the user's key was verified
-- against Brewfather. Keys are now validated with a live Brewfather call
-- BEFORE they are stored (never persisted unverified), so
-- `store_brewfather_credentials` stamps it on both the insert and the
-- replace path, and `touch_brewfather_validated` refreshes it when the user
-- runs "Test connection" in Settings.

alter table public.brewfather_credentials
  add column if not exists last_validated_at timestamptz;

-- Same body as migration 0001 plus the `last_validated_at` stamp. CREATE OR
-- REPLACE keeps the existing grants (execute for authenticated only).
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
      set bf_user_id = p_bf_user_id,
          last_validated_at = now(),
          updated_at = now()
      where user_id = v_uid;
  else
    v_secret_id := vault.create_secret(
      p_api_key,
      'bf_api_key_' || v_uid::text,
      'Brewfather API key'
    );
    insert into public.brewfather_credentials
      (user_id, bf_user_id, api_key_secret_id, last_validated_at)
    values (v_uid, p_bf_user_id, v_secret_id, now());
  end if;
end;
$$;

-- Refresh the caller's `last_validated_at` after a successful re-validation
-- ("Test connection"). SECURITY DEFINER because clients have no update policy
-- on the table — all writes stay behind vetted functions.
create or replace function public.touch_brewfather_validated()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update public.brewfather_credentials
    set last_validated_at = now()
    where user_id = v_uid;
  if not found then
    raise exception 'brewfather is not connected';
  end if;
end;
$$;

revoke all on function public.touch_brewfather_validated() from public;
grant execute on function public.touch_brewfather_validated() to authenticated;
