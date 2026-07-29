/**
 * @vitest-environment node
 *
 * The token_hash landing route. The behavior that matters here is where each
 * link *type* ends up: a recovery link must reach the password form, because
 * verifying a recovery token already grants a full session — land it on
 * /dashboard and the user is silently signed in and never asked to reset.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { verifyOtp } })),
}));

import { NextRequest } from "next/server";

import { GET } from "../route";

const ORIGIN = "https://brewable.vercel.app";

/** Run the route and return the Location header it redirected to. */
async function locationFor(query: string): Promise<string> {
  const response = await GET(new NextRequest(`${ORIGIN}/auth/confirm${query}`));
  return response.headers.get("location") ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  verifyOtp.mockResolvedValue({ error: null });
});

describe("GET /auth/confirm", () => {
  it("sends a verified recovery link to the password form", async () => {
    const location = await locationFor("?token_hash=abc&type=recovery");

    expect(verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "abc",
    });
    expect(location).toBe(`${ORIGIN}/reset-password`);
  });

  it("still sends other verified link types to the dashboard", async () => {
    expect(await locationFor("?token_hash=abc&type=signup")).toBe(
      `${ORIGIN}/dashboard`
    );
    expect(await locationFor("?token_hash=abc&type=magiclink")).toBe(
      `${ORIGIN}/dashboard`
    );
  });

  it("honors an explicit safe next over the per-type default", async () => {
    expect(
      await locationFor("?token_hash=abc&type=recovery&next=/dashboard/settings")
    ).toBe(`${ORIGIN}/dashboard/settings`);
  });

  it("does not let an unsafe next escape the recovery default", async () => {
    expect(
      await locationFor("?token_hash=abc&type=recovery&next=https://evil.com")
    ).toBe(`${ORIGIN}/reset-password`);
    expect(
      await locationFor("?token_hash=abc&type=recovery&next=//evil.com")
    ).toBe(`${ORIGIN}/reset-password`);
  });

  it("explains a dead recovery link in recovery terms", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });

    const location = await locationFor("?token_hash=abc&type=recovery");

    expect(location).toContain("/login?error=");
    expect(decodeURIComponent(location)).toContain("password reset link");
  });

  it("keeps the sign-in wording for a dead sign-in link", async () => {
    verifyOtp.mockResolvedValue({ error: new Error("expired") });

    const location = await locationFor("?token_hash=abc&type=magiclink");

    expect(decodeURIComponent(location)).toContain("sign-in link");
  });

  it("rejects a request with no token", async () => {
    const location = await locationFor("?type=recovery");

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(location).toContain("/login?error=");
  });
});
