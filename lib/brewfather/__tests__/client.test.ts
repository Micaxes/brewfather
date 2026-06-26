/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import {
  BrewfatherAuthError,
  BrewfatherError,
  buildAuthHeader,
  createBrewfatherClient,
  normalizeInventoryItem,
  normalizeRecipeDetail,
  normalizeRecipeSummary,
  retryAfterMs,
} from "@/lib/brewfather/client";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("buildAuthHeader", () => {
  it("base64-encodes userid:apikey as HTTP Basic", () => {
    const expected = `Basic ${Buffer.from("user:key").toString("base64")}`;
    expect(buildAuthHeader("user", "key")).toBe(expected);
  });
});

describe("createBrewfatherClient", () => {
  it("throws BrewfatherAuthError when credentials are missing", () => {
    expect(() => createBrewfatherClient({ userId: "", apiKey: "" })).toThrow(
      BrewfatherAuthError
    );
  });

  it("sends Basic auth and Accept headers on requests", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = createBrewfatherClient({ userId: "u", apiKey: "k", fetchImpl });

    await client.getRecipes();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0]![1];
    expect(init.headers.Authorization).toBe(buildAuthHeader("u", "k"));
    expect(init.headers.Accept).toBe("application/json");
  });

  it("paginates with limit/start_after until a short page", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => ({
      _id: `r${i}`,
      name: `Recipe ${i}`,
    }));
    const page2 = [{ _id: "r50", name: "Recipe 50" }];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    const client = createBrewfatherClient({
      userId: "u",
      apiKey: "k",
      fetchImpl,
      pageSize: 50,
    });

    const recipes = await client.getRecipes();

    expect(recipes).toHaveLength(51);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const url1 = fetchImpl.mock.calls[0]![0] as string;
    const url2 = fetchImpl.mock.calls[1]![0] as string;
    expect(url1).toContain("/v2/recipes?limit=50");
    expect(url1).not.toContain("start_after");
    // cursor advances using the last id of the previous page.
    expect(url2).toContain("start_after=r49");
  });

  it("honors 429 Retry-After with bounded backoff, then succeeds", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", { status: 429, headers: { "retry-after": "2" } })
      )
      .mockResolvedValueOnce(jsonResponse([{ _id: "r0", name: "Recipe 0" }]));
    const client = createBrewfatherClient({
      userId: "u",
      apiKey: "k",
      fetchImpl,
      sleep,
    });

    const recipes = await client.getRecipes();

    expect(recipes).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("gives up after maxRetries on repeated 429", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 429, headers: { "retry-after": "1" } })
      );
    const client = createBrewfatherClient({
      userId: "u",
      apiKey: "k",
      fetchImpl,
      sleep,
      maxRetries: 2,
    });

    await expect(client.getRecipes()).rejects.toBeInstanceOf(BrewfatherError);
    // initial attempt + 2 retries.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("throws BrewfatherError carrying the status on non-2xx", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 500, statusText: "Server Error" }));
    const client = createBrewfatherClient({ userId: "u", apiKey: "k", fetchImpl });

    await expect(client.getRecipes()).rejects.toMatchObject({ status: 500 });
  });

  it("getData returns normalized inventory and full recipes", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes("/v2/inventory/fermentables")) {
        return jsonResponse([{ _id: "f1", name: "2-Row", inventory: 5 }]);
      }
      if (url.includes("/v2/inventory/hops")) {
        return jsonResponse([{ _id: "h1", name: "Cascade", inventory: 80, alpha: 5.5 }]);
      }
      if (url.includes("/v2/inventory/yeasts")) {
        return jsonResponse([{ _id: "y1", name: "US-05", inventory: 2, attenuation: 81 }]);
      }
      if (url.includes("/v2/inventory/miscs")) {
        return jsonResponse([]);
      }
      if (url.includes("/v2/recipes/")) {
        return jsonResponse({
          _id: "r1",
          name: "Pale Ale",
          fermentables: [{ _id: "f1", name: "2-Row", amount: 4.5 }],
          hops: [],
          yeasts: [],
          miscs: [],
        });
      }
      if (url.includes("/v2/recipes")) {
        return jsonResponse([{ _id: "r1", name: "Pale Ale" }]);
      }
      throw new Error(`unexpected url: ${url}`);
    });
    const client = createBrewfatherClient({ userId: "u", apiKey: "k", fetchImpl });

    const data = await client.getData();

    expect(data.inventory).toHaveLength(3);
    expect(data.inventory.find((i) => i.category === "hop")?.alpha).toBe(5.5);
    expect(data.recipes).toHaveLength(1);
    expect(data.recipes[0]!.fermentables[0]!.name).toBe("2-Row");
  });
});

describe("retryAfterMs", () => {
  it("parses a seconds value", () => {
    expect(retryAfterMs("5", 0)).toBe(5000);
  });

  it("caps oversized waits", () => {
    expect(retryAfterMs("99999", 0)).toBe(30_000);
  });

  it("falls back to exponential backoff when absent", () => {
    expect(retryAfterMs(null, 0)).toBe(1000);
    expect(retryAfterMs(null, 1)).toBe(2000);
    expect(retryAfterMs(null, 2)).toBe(4000);
  });

  it("handles an HTTP-date value", () => {
    const future = new Date(Date.now() + 3000).toUTCString();
    const ms = retryAfterMs(future, 0);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(30_000);
  });
});

describe("normalizeInventoryItem", () => {
  it("maps a hop with alpha and the inventory amount", () => {
    const item = normalizeInventoryItem(
      { _id: "h1", name: "Cascade", alpha: 5.5, inventory: 100, color: 999 },
      "hop"
    );
    expect(item).toEqual({
      id: "h1",
      name: "Cascade",
      category: "hop",
      amount: 100,
      unit: "g",
      alpha: 5.5,
    });
  });

  it("maps a fermentable with color and defaults the unit to kg", () => {
    const item = normalizeInventoryItem(
      { _id: "f1", name: "Maris Otter", color: 3.5, inventory: 5 },
      "fermentable"
    );
    expect(item).toEqual({
      id: "f1",
      name: "Maris Otter",
      category: "fermentable",
      amount: 5,
      unit: "kg",
      color: 3.5,
    });
  });

  it("maps yeast attenuation and treats a missing amount as 0", () => {
    const item = normalizeInventoryItem(
      { _id: "y1", name: "US-05", attenuation: 81 },
      "yeast"
    );
    expect(item).toEqual({
      id: "y1",
      name: "US-05",
      category: "yeast",
      amount: 0,
      unit: "pkg",
      attenuation: 81,
    });
  });

  it("respects an explicit unit and tolerates a missing id", () => {
    const item = normalizeInventoryItem(
      { name: "Mystery", inventory: 2, unit: "oz" },
      "misc"
    );
    expect(item).toEqual({
      id: "",
      name: "Mystery",
      category: "misc",
      amount: 2,
      unit: "oz",
    });
  });
});

describe("normalizeRecipeSummary", () => {
  it("extracts the style name from an object and the batch size", () => {
    const recipe = normalizeRecipeSummary({
      _id: "r1",
      name: "Pale Ale",
      author: "me",
      style: { name: "American Pale Ale" },
      batchSize: 20,
    });
    expect(recipe).toEqual({
      id: "r1",
      name: "Pale Ale",
      style: "American Pale Ale",
      author: "me",
      batchSize: 20,
    });
  });

  it("accepts a string style and omits absent optionals", () => {
    const recipe = normalizeRecipeSummary({ _id: "r2", name: "SMaSH", style: "IPA" });
    expect(recipe).toEqual({ id: "r2", name: "SMaSH", style: "IPA" });
  });
});

describe("normalizeRecipeDetail", () => {
  it("normalizes ingredient arrays with category and default units", () => {
    const detail = normalizeRecipeDetail({
      _id: "r1",
      name: "Pale Ale",
      fermentables: [{ _id: "f1", name: "2-Row", amount: 4.5 }],
      hops: [{ _id: "h1", name: "Cascade", amount: 30 }],
      yeasts: [{ _id: "y1", name: "US-05", amount: 1 }],
      miscs: [{ _id: "m1", name: "Irish Moss", amount: 5, unit: "g" }],
    });
    expect(detail.fermentables[0]).toEqual({
      id: "f1",
      name: "2-Row",
      category: "fermentable",
      amount: 4.5,
      unit: "kg",
    });
    expect(detail.hops[0]).toEqual({
      id: "h1",
      name: "Cascade",
      category: "hop",
      amount: 30,
      unit: "g",
    });
    expect(detail.yeasts[0]!.unit).toBe("pkg");
    expect(detail.miscs[0]!.category).toBe("misc");
  });

  it("defaults missing ingredient arrays to empty", () => {
    const detail = normalizeRecipeDetail({ _id: "r9", name: "Empty" });
    expect(detail).toMatchObject({
      id: "r9",
      name: "Empty",
      fermentables: [],
      hops: [],
      yeasts: [],
      miscs: [],
    });
  });
});
