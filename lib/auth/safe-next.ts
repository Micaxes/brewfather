/**
 * Open-redirect guard for `?next=` params on the auth callback routes.
 *
 * Only allows relative, non-protocol-relative redirect targets: anything that
 * is absolute (`https://evil.com`), protocol-relative (`//evil.com`), or a
 * backslash variant browsers may normalize to `//` (`/\evil.com`) falls back
 * to `/dashboard`. Shared by `app/auth/confirm` and `app/auth/callback`.
 */
export function safeNext(next: string | null): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return "/dashboard";
}
