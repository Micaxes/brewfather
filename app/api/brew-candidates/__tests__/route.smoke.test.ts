/**
 * @vitest-environment node
 *
 * Route-level integration smoke test: drives GET /api/brew-candidates through
 * the real matcher with fixture data (Brewfather client + per-user credential
 * lookup mocked) and asserts the three buckets are produced, plus the
 * not-connected fallback and the manual-sync (`?refresh=true`) cooldown.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BrewCandidatesResponse } from "@/lib/api-contract";
import type { InventoryItem, RecipeDetail } from "@/lib/brewfather/types";

vi.mock("@/lib/brewfather/client", async (importActual) => {
  const actual =
    await importActual<typeof import("@/lib/brewfather/client")>();
  return { ...actual, createBrewfatherClient: vi.fn() };
});

vi.mock("@/lib/brewfather/user-credentials", () => ({
  getUserBrewfatherCredentials: vi.fn(),
}));

const WRITTEN_AT = "2026-07-04T12:00:00.000Z";

vi.mock("@/lib/brewfather/cache", () => ({
  getFreshCachedData: vi.fn(async () => null),
  getLastSyncedAt: vi.fn(async () => null),
  setCachedData: vi.fn(async () => WRITTEN_AT),
}));

import { GET } from "@/app/api/brew-candidates/route";
import {
  getFreshCachedData,
  getLastSyncedAt,
  setCachedData,
} from "@/lib/brewfather/cache";
import { createBrewfatherClient } from "@/lib/brewfather/client";
import { getUserBrewfatherCredentials } from "@/lib/brewfather/user-credentials";
import inventoryFixture from "@/lib/matcher/fixtures/inventory.json";
import recipesFixture from "@/lib/matcher/fixtures/recipes.json";

const inventory = inventoryFixture as unknown as InventoryItem[];
const recipes = recipesFixture as unknown as RecipeDetail[];

const req = () => new Request("http://localhost/api/brew-candidates");
const refreshReq = () =>
  new Request("http://localhost/api/brew-candidates?refresh=true");

function connect() {
  vi.mocked(getUserBrewfatherCredentials).mockResolvedValue({
    userId: "u",
    apiKey: "k",
  });
}

function mockUpstream() {
  const getData = vi.fn(async () => ({ inventory, recipes }));
  vi.mocked(createBrewfatherClient).mockReturnValue({
    getData,
  } as unknown as ReturnType<typeof createBrewfatherClient>);
  return getData;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/brew-candidates", () => {
  it("produces all three buckets end-to-end from fixture data", async () => {
    connect();
    mockUpstream();

    const res = await GET(req());
    expect(res.status).toBe(200);

    const body = (await res.json()) as BrewCandidatesResponse;
    expect(body.candidates).toHaveLength(3);
    expect(new Set(body.candidates.map((c) => c.bucket))).toEqual(
      new Set(["brew_now", "almost", "not_yet"])
    );
    expect(typeof body.generatedAt).toBe("string");
    // Cache miss → fetched upstream, repopulated the cache, and reported the
    // written fetched_at as the authoritative syncedAt.
    expect(getFreshCachedData).toHaveBeenCalled();
    expect(setCachedData).toHaveBeenCalledTimes(1);
    expect(body.syncedAt).toBe(WRITTEN_AT);
    expect(body.cooldownSeconds).toBeUndefined();
  });

  it("serves cached data without hitting Brewfather when fresh", async () => {
    connect();
    const cachedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    vi.mocked(getFreshCachedData).mockResolvedValueOnce({ inventory, recipes });
    vi.mocked(getLastSyncedAt).mockResolvedValueOnce(cachedAt);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as BrewCandidatesResponse;
    expect(body.candidates).toHaveLength(3);
    expect(body.syncedAt).toBe(cachedAt);
    // A normal (param-less) load is never throttled.
    expect(body.cooldownSeconds).toBeUndefined();
    // Cache hit → no upstream client, no cache write.
    expect(createBrewfatherClient).not.toHaveBeenCalled();
    expect(setCachedData).not.toHaveBeenCalled();
  });

  it("returns empty candidates with a warning when Brewfather is not connected", async () => {
    vi.mocked(getUserBrewfatherCredentials).mockResolvedValue(null);

    const res = await GET(req());
    expect(res.status).toBe(200);

    const body = (await res.json()) as BrewCandidatesResponse;
    expect(body.candidates).toEqual([]);
    expect(body.warnings.length).toBeGreaterThan(0);
    expect(body.warnings[0]).toMatch(/Settings/i);
    expect(body.syncedAt).toBeNull();
    expect(createBrewfatherClient).not.toHaveBeenCalled();
  });

  it("?refresh=true bypasses a fresh cache and re-syncs from Brewfather", async () => {
    connect();
    const getData = mockUpstream();
    // Last sync long outside the cooldown window.
    vi.mocked(getLastSyncedAt).mockResolvedValueOnce(
      new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    );

    const res = await GET(refreshReq());
    expect(res.status).toBe(200);

    const body = (await res.json()) as BrewCandidatesResponse;
    expect(body.candidates).toHaveLength(3);
    expect(getData).toHaveBeenCalledTimes(1);
    expect(setCachedData).toHaveBeenCalledTimes(1);
    // The cached data is never consulted on a forced refresh.
    expect(getFreshCachedData).not.toHaveBeenCalled();
    expect(body.syncedAt).toBe(WRITTEN_AT);
    expect(body.cooldownSeconds).toBeUndefined();
  });

  it("rejects a refresh inside the cooldown window without calling Brewfather", async () => {
    connect();
    mockUpstream();
    const justSyncedAt = new Date(Date.now() - 10_000).toISOString();
    vi.mocked(getLastSyncedAt).mockResolvedValueOnce(justSyncedAt);
    vi.mocked(getFreshCachedData).mockResolvedValueOnce({ inventory, recipes });

    const res = await GET(refreshReq());
    expect(res.status).toBe(200);

    const body = (await res.json()) as BrewCandidatesResponse;
    // Cached candidates are still served — a cooldown is a signal, not an error.
    expect(body.candidates).toHaveLength(3);
    expect(body.syncedAt).toBe(justSyncedAt);
    expect(body.cooldownSeconds).toBeGreaterThanOrEqual(1);
    expect(body.cooldownSeconds).toBeLessThanOrEqual(60);
    // No upstream traffic, no cache clobbering.
    expect(createBrewfatherClient).not.toHaveBeenCalled();
    expect(setCachedData).not.toHaveBeenCalled();
  });

  it("never throttles a normal load even right after a sync", async () => {
    connect();
    mockUpstream();
    vi.mocked(getFreshCachedData).mockResolvedValueOnce({ inventory, recipes });
    vi.mocked(getLastSyncedAt).mockResolvedValueOnce(
      new Date(Date.now() - 5_000).toISOString()
    );

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as BrewCandidatesResponse;
    expect(body.candidates).toHaveLength(3);
    expect(body.cooldownSeconds).toBeUndefined();
  });

  it("does not overwrite the cache when the upstream fetch fails", async () => {
    connect();
    vi.mocked(createBrewfatherClient).mockReturnValue({
      getData: vi.fn(async () => {
        throw new Error("brewfather 500");
      }),
    } as unknown as ReturnType<typeof createBrewfatherClient>);

    const res = await GET(refreshReq());
    expect(res.status).toBe(502);

    const body = (await res.json()) as BrewCandidatesResponse;
    expect(body.candidates).toEqual([]);
    expect(body.syncedAt).toBeNull();
    // getData() threw before the write — the previous good cache row survives.
    expect(setCachedData).not.toHaveBeenCalled();
  });
});
