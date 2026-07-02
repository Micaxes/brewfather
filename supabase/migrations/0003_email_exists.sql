-- Email-first auth: check whether an account already exists for an email.
--
-- Supabase exposes no public "does this email exist" endpoint (to limit user
-- enumeration). This SECURITY DEFINER function is granted ONLY to service_role,
-- so it can be called from a server action via the admin (secret-key) client —
-- never from the browser (anon) or an authenticated session.

create or replace function public.email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.email_exists(text) from public;
grant execute on function public.email_exists(text) to service_role;
