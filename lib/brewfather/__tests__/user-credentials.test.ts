/**
 * @vitest-environment node
 *
 * Per-user credential helpers: validate-before-store mapping (#23), the RPC
 * wiring for store/delete/touch (the SQL behind them is asserted in
 * supabase/__tests__/migrations.test.ts — deleting removes the Vault secret),
 * and connection health.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn(() => ({
  select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
    rpc,
    from,
  })),
}));

import {
  deleteUserBrewfatherCredentials,
  getBrewfatherConnection,
  getUserBrewfatherCredentials,
  saveUserBrewfatherCredentials,
  touchBrewfatherValidated,
  validateBrewfatherCredentials,
} from "@/lib/brewfather/user-credentials";

const user = { data: { user: { id: "user-1" } } };

afterEach(() => {
  vi.clearAllMocks();
});

describe("validateBrewfatherCredentials", () => {
  const respond = (status: number) =>
    vi.fn<typeof fetch>(async () => new Response("[]", { status }));

  it("returns ok on a successful cheap read", async () => {
    const fetchImpl = respond(200);
    const result = await validateBrewfatherCredentials("u", "k", { fetchImpl });
    expect(result).toEqual({ ok: true });
    // Exactly one lightweight request — never a full data pull.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toContain(
      "/v2/inventory/fermentables?limit=1"
    );
  });

  it("maps 401 to invalid (wrong or revoked key)", async () => {
    const result = await validateBrewfatherCredentials("u", "bad", {
      fetchImpl: respond(401),
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("maps 403 to invalid (insufficient scope)", async () => {
    const result = await validateBrewfatherCredentials("u", "k", {
      fetchImpl: respond(403),
    });
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("maps 429 to rate_limited without retry sleeps", async () => {
    const fetchImpl = respond(429);
    const result = await validateBrewfatherCredentials("u", "k", { fetchImpl });
    expect(result).toEqual({ ok: false, reason: "rate_limited" });
    // maxRetries=0: validation answers immediately instead of backing off.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps 5xx and network failures to unreachable", async () => {
    expect(
      await validateBrewfatherCredentials("u", "k", { fetchImpl: respond(500) })
    ).toEqual({ ok: false, reason: "unreachable" });
    expect(
      await validateBrewfatherCredentials("u", "k", {
        fetchImpl: vi.fn(async () => {
          throw new Error("ECONNREFUSED");
        }),
      })
    ).toEqual({ ok: false, reason: "unreachable" });
  });

  it("treats empty credentials as invalid input, not a crash", async () => {
    const result = await validateBrewfatherCredentials("", "", {
      fetchImpl: respond(200),
    });
    // createBrewfatherClient throws BrewfatherAuthError (no status) → unreachable.
    expect(result.ok).toBe(false);
  });
});

describe("credential RPC wiring", () => {
  it("saveUserBrewfatherCredentials calls store_brewfather_credentials", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await saveUserBrewfatherCredentials("bf-user", "secret-key");
    expect(rpc).toHaveBeenCalledWith("store_brewfather_credentials", {
      p_bf_user_id: "bf-user",
      p_api_key: "secret-key",
    });
  });

  it("deleteUserBrewfatherCredentials calls delete_brewfather_credentials (row + Vault secret)", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await deleteUserBrewfatherCredentials();
    expect(rpc).toHaveBeenCalledWith("delete_brewfather_credentials");
  });

  it("touchBrewfatherValidated calls touch_brewfather_validated and throws on error", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await touchBrewfatherValidated();
    expect(rpc).toHaveBeenCalledWith("touch_brewfather_validated");

    rpc.mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(touchBrewfatherValidated()).rejects.toThrow("boom");
  });

  it("getUserBrewfatherCredentials returns null when not signed in or rpc fails", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect(await getUserBrewfatherCredentials()).toBeNull();

    getUser.mockResolvedValueOnce(user);
    rpc.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    expect(await getUserBrewfatherCredentials()).toBeNull();
  });

  it("getUserBrewfatherCredentials maps the decrypted row", async () => {
    getUser.mockResolvedValueOnce(user);
    rpc.mockResolvedValueOnce({
      data: [{ bf_user_id: "bf-user", api_key: "decrypted" }],
      error: null,
    });
    expect(await getUserBrewfatherCredentials()).toEqual({
      userId: "bf-user",
      apiKey: "decrypted",
    });
  });
});

describe("getBrewfatherConnection", () => {
  it("reports connection health including lastValidatedAt", async () => {
    getUser.mockResolvedValueOnce(user);
    maybeSingle.mockResolvedValueOnce({
      data: {
        bf_user_id: "bf-user",
        last_validated_at: "2026-07-04T10:00:00.000Z",
      },
      error: null,
    });

    expect(await getBrewfatherConnection()).toEqual({
      connected: true,
      bfUserId: "bf-user",
      lastValidatedAt: "2026-07-04T10:00:00.000Z",
    });
  });

  it("still reports connected when the meta column is not deployed yet", async () => {
    getUser.mockResolvedValueOnce(user);
    // First select (with last_validated_at) errors on the missing column…
    maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "column does not exist" },
    });
    // …the bare fallback still resolves the connection.
    maybeSingle.mockResolvedValueOnce({
      data: { bf_user_id: "bf-user" },
      error: null,
    });

    expect(await getBrewfatherConnection()).toEqual({
      connected: true,
      bfUserId: "bf-user",
      lastValidatedAt: null,
    });
  });

  it("returns not-connected when signed out or no row", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect(await getBrewfatherConnection()).toEqual({ connected: false });

    getUser.mockResolvedValueOnce(user);
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await getBrewfatherConnection()).toEqual({ connected: false });
  });
});
