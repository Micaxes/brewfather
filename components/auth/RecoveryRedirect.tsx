"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { EXPIRED_SESSION_MESSAGE } from "@/lib/auth/password";

/**
 * Rescues password-recovery links that use Supabase's stock email template.
 *
 * That template links to `{{ .ConfirmationURL }}`, which GoTrue resolves to
 * `/auth/v1/verify?...&redirect_to={SiteURL}` — so after verifying, the user is
 * bounced to the site root (this landing page) with the session in the URL
 * *fragment* (`#access_token=…&type=recovery`). Fragments never reach the
 * server, so no route handler can see them: without this, the recovery link
 * just renders the marketing page and the reset silently never happens.
 *
 * Here we let the browser client consume the fragment (which persists the
 * session to cookies) and forward to the password form. Pointing the template
 * at `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` instead makes
 * this path unnecessary — it stays as a safety net for links already in flight
 * and for any template that gets reset to the default.
 */
export function RecoveryRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#")) return;
    const params = new URLSearchParams(hash.slice(1));

    // GoTrue reports a dead link in the fragment too (e.g. otp_expired).
    if (params.get("error") ?? params.get("error_code")) {
      const description = params.get("error_description");
      router.replace(
        `/login?error=${encodeURIComponent(
          description ? description.replace(/\+/g, " ") : EXPIRED_SESSION_MESSAGE
        )}`
      );
      return;
    }

    if (params.get("type") !== "recovery") return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    // Imported lazily so the marketing page doesn't ship the auth client to
    // every visitor who isn't mid-recovery.
    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        if (cancelled) return;
        const supabase = createClient();

        // INITIAL_SESSION fires once the client has finished parsing the URL;
        // PASSWORD_RECOVERY fires for recovery links specifically. An
        // INITIAL_SESSION carrying no session means the fragment was malformed
        // or already spent — say so instead of leaving the user staring at the
        // marketing page, which is the bug this component exists to fix.
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;
          if (event === "PASSWORD_RECOVERY" || session) {
            router.replace("/reset-password");
          } else if (event === "INITIAL_SESSION") {
            router.replace(
              `/login?error=${encodeURIComponent(EXPIRED_SESSION_MESSAGE)}`
            );
          }
        });
        unsubscribe = () => subscription.unsubscribe();
      } catch {
        // Misconfigured env: leave the landing page as-is rather than crash it.
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router]);

  return null;
}
