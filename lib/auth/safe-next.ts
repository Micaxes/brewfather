/**
 * Open-redirect guard for `?next=` params on the auth callback routes.
 *
 * Only allows relative, non-protocol-relative redirect targets: anything that
 * is absolute (`https://evil.com`), protocol-relative (`//evil.com`), or a
 * backslash variant browsers may normalize to `//` (`/\evil.com`) falls back
 * to `fallback`. Shared by `app/auth/confirm` and `app/auth/callback`.
 *
 * `fallback` lets recovery links default to the password form instead of the
 * dashboard — a recovery token grants a real session, so without it the user
 * would land signed-in on `/dashboard` and never be asked for a new password.
 */
export function safeNext(
  next: string | null,
  fallback: string = "/dashboard"
): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return fallback;
}

/** Where an auth link lands when it carries no explicit `?next=`. */
export function defaultNextForType(type: string | null): string {
  return type === "recovery" ? "/reset-password" : "/dashboard";
}
