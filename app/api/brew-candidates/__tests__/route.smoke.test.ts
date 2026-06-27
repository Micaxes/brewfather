/**
 * @vitest-environment node
 *
 * Route-level integration smoke test: drives GET /api/brew-candidates through
 * the real matcher with fixture data (Brewfather client mocked) and asserts the
 * three buckets are produced, plus the credentials-absent fallback.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BrewCandidatesResponse } from "@/lib/api-contract";
import type { InventoryItem, RecipeDetail } from "@/lib/brewfather/types";

vi.mock("@/lib/brewfather/client", async (importActual) => {
  const actual =
    await importActual<typeof import("@/lib/brewfather/client")>();
  return { ...actual, createBrewfatherClient: vi.fn() };
});

import { GET } from "@/app/api/brew-candidates/route";
import {
  BrewfatherAuthError,
  createBrewfatherClient,
} from "@/lib/brewfather/client";
import inventoryFixture from "@/lib/matcher/fixtures/inventory.json";
import recipesFixture from "@/lib/matcher/fixtures/recipes.json";

const inventory = inventoryFixture as unknown as InventoryItem[];
const recipes = recipesFixture as unknown as RecipeDetail[];

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/brew-candidates", () => {
  it("produces all three buckets end-to-end from fixture data", async () => {
    vi.mocked(createBrewfatherClient).mockReturnValue({
      getData: vi.fn(async () => ({ inventory, recipes })),
    } as unknown as ReturnType<typeof createBrewfatherClient>);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = (await res.json()) as BrewCandidatesResponse;
    expect(body.candidates).toHaveLength(3);
    expect(new Set(body.candidates.map((c) => c.bucket))).toEqual(
      new Set(["brew_now", "almost", "not_yet"])
    );
    expect(typeof body.generatedAt).toBe("string");
  });

  it("returns empty candidates with a warning when credentials are absent", async () => {
    vi.mocked(createBrewfatherClient).mockImplementation(() => {
      throw new BrewfatherAuthError();
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = (await res.json()) as BrewCandidatesResponse;
    expect(body.candidates).toEqual([]);
    expect(body.warnings.length).toBeGreaterThan(0);
    expect(body.warnings[0]).toMatch(/BF_USER_ID/);
  });
});
