/**
 * OAuth / email-confirmation callback: exchanges the `code` for a session and
 * redirects into the app. Used by Supabase email confirmation links and OAuth
 * providers (e.g. "Continue with Google" — PKCE flow via `signInWithOAuth`).
 */
import { NextResponse } from "next/server";

import { safeNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Behind Vercel's proxy `origin` is the internal host; honor the forwarded
  // host so the post-auth redirect lands on the origin the user is browsing.
  // Use the forwarded protocol too (`next start` self-populates these headers
  // even without a proxy, where hardcoding https would break plain-http
  // servers). Proxies may send a comma-separated list; the first entry is the
  // client-facing one.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const isLocalEnv = process.env.NODE_ENV === "development";
  const target =
    isLocalEnv || !forwardedHost
      ? origin
      : `${forwardedProto}://${forwardedHost}`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${target}${next}`);
    }
  }

  return NextResponse.redirect(
    `${target}/login?error=${encodeURIComponent("Could not complete sign-in.")}`
  );
}
