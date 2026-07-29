/**
 * Email confirmation / magic-link / password-recovery landing (Supabase SSR
 * token_hash flow).
 *
 * Supabase email templates point here with `token_hash` + `type`; we verify the
 * OTP (which establishes the SSR cookie session without needing the PKCE
 * `code_verifier`, so it works cross-device) and redirect the user into the
 * app. This is what lands a freshly-confirmed user straight in the dashboard,
 * and a `type=recovery` link on the set-a-new-password form.
 */
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { defaultNextForType, safeNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

const INVALID_LINK_MESSAGE =
  "That sign-in link is invalid or has expired. Please sign in with your email and password.";
const INVALID_RECOVERY_MESSAGE =
  "That password reset link is invalid, expired, or has already been used. Ask for a new one.";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), defaultNextForType(type));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      type === "recovery" ? INVALID_RECOVERY_MESSAGE : INVALID_LINK_MESSAGE
    )}`
  );
}
