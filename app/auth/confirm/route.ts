/**
 * Email confirmation / magic-link landing (Supabase SSR token_hash flow).
 *
 * Supabase email templates point here with `token_hash` + `type`; we verify the
 * OTP (which establishes the SSR cookie session without needing the PKCE
 * `code_verifier`, so it works cross-device) and redirect the user into the
 * app. This is what lands a freshly-confirmed user straight in the dashboard.
 */
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "That sign-in link is invalid or has expired. Please sign in with your email and password."
    )}`
  );
}
