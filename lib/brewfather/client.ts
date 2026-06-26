/**
 * Server-only Brewfather API client.
 *
 * Talks to https://api.brewfather.app using HTTP Basic auth built from
 * `BF_USER_ID` / `BF_API_KEY`. The key is read from the environment, used only
 * to build the `Authorization` header, and never returned to callers. Import
 * this module from server code only (route handlers); a runtime guard throws if
 * it is ever evaluated in the browser.
 *
 * Responses are normalized to the frozen contracts in `lib/brewfather/types.ts`
 * so the matcher (Task 3) and UI (Task 4) never see raw upstream payloads.
 *
 * The client is created via {@link createBrewfatherClient}, which accepts
 * injectable `fetchImpl`/`sleep` so the network and backoff timing can be
 * mocked in tests.
 */
import type {
  IngredientCategory,
  InventoryItem,
  Recipe,
  RecipeDetail,
  RecipeIngredient,
} from "@/lib/brewfather/types";

const DEFAULT_BASE_URL = "https://api.brewfather.app";
/** Brewfather caps pages at 50 items. */
const MAX_PAGE_SIZE = 50;
const DEFAULT_MAX_RETRIES = 3;
/** Upper bound on any single backoff wait so a hostile `Retry-After` can't hang us. */
const MAX_BACKOFF_MS = 30_000;
/** Safety cap on pagination loops in case the cursor never advances. */
const MAX_PAGES = 500;
/** How many recipe-detail requests to run at once (gentle on the rate limit). */
const RECIPE_DETAIL_CONCURRENCY = 4;

const INVENTORY_ENDPOINTS: ReadonlyArray<{
  path: string;
  category: IngredientCategory;
}> = [
  { path: "/v2/inventory/fermentables", category: "fermentable" },
  { path: "/v2/inventory/hops", category: "hop" },
  { path: "/v2/inventory/yeasts", category: "yeast" },
  { path: "/v2/inventory/miscs", category: "misc" },
];

/** Error talking to Brewfather (non-2xx after retries, bad payload, etc.). */
export class BrewfatherError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "BrewfatherError";
    this.status = status;
  }
}

/** Thrown when `BF_USER_ID` / `BF_API_KEY` are not configured. */
export class BrewfatherAuthError extends BrewfatherError {
  constructor(
    message = "Brewfather credentials are not configured (set BF_USER_ID and BF_API_KEY)."
  ) {
    super(message);
    this.name = "BrewfatherAuthError";
  }
}

export interface BrewfatherClientOptions {
  /** Defaults to `process.env.BF_USER_ID`. */
  userId?: string;
  /** Defaults to `process.env.BF_API_KEY`. */
  apiKey?: string;
  /** Defaults to https://api.brewfather.app. */
  baseUrl?: string;
  /** Injectable fetch (defaults to the global `fetch`). */
  fetchImpl?: typeof fetch;
  /** Injectable sleep used for backoff (defaults to a real timer). */
  sleep?: (ms: number) => Promise<void>;
  /** Max retries on HTTP 429 (default 3). */
  maxRetries?: number;
  /** Page size for paginated endpoints (1–50, default 50). */
  pageSize?: number;
}

/** Normalized payload returned by the data route: inventory + full recipes. */
export interface BrewfatherData {
  inventory: InventoryItem[];
  recipes: RecipeDetail[];
}

export interface BrewfatherClient {
  getInventory(): Promise<InventoryItem[]>;
  getRecipes(): Promise<Recipe[]>;
  getRecipeDetail(id: string): Promise<RecipeDetail>;
  getRecipeDetails(): Promise<RecipeDetail[]>;
  getData(): Promise<BrewfatherData>;
}

interface RequestContext {
  baseUrl: string;
  authHeader: string;
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  maxRetries: number;
  pageSize: number;
}

/** Build the HTTP Basic `Authorization` header value for the given credentials. */
export function buildAuthHeader(userId: string, apiKey: string): string {
  const token = Buffer.from(`${userId}:${apiKey}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Resolve a `Retry-After` header (seconds or HTTP date) to a bounded wait in ms.
 * Falls back to exponential backoff (base 1s) when the header is absent/invalid.
 */
export function retryAfterMs(headerValue: string | null, attempt: number): number {
  if (headerValue) {
    const seconds = Number(headerValue);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_BACKOFF_MS);
    }
    const dateMs = Date.parse(headerValue);
    if (!Number.isNaN(dateMs)) {
      return Math.min(Math.max(dateMs - Date.now(), 0), MAX_BACKOFF_MS);
    }
  }
  return Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampPageSize(size: number | undefined): number {
  if (size === undefined || !Number.isFinite(size)) return MAX_PAGE_SIZE;
  return Math.max(1, Math.min(Math.floor(size), MAX_PAGE_SIZE));
}

/** GET `path`, retrying on 429 with bounded backoff, and parse the JSON body. */
async function requestJson(path: string, ctx: RequestContext): Promise<unknown> {
  const url = `${ctx.baseUrl}${path}`;
  for (let attempt = 0; ; attempt++) {
    const res = await ctx.fetchImpl(url, {
      headers: { Authorization: ctx.authHeader, Accept: "application/json" },
    });
    if (res.status === 429 && attempt < ctx.maxRetries) {
      await ctx.sleep(retryAfterMs(res.headers.get("retry-after"), attempt));
      continue;
    }
    if (!res.ok) {
      // Intentionally omit the response body: it could echo request details.
      throw new BrewfatherError(
        `Brewfather request failed (${res.status} ${res.statusText}) for ${path}`,
        res.status
      );
    }
    try {
      return await res.json();
    } catch {
      throw new BrewfatherError(`Brewfather returned invalid JSON for ${path}`);
    }
  }
}

/** Follow `limit`/`start_after` pagination until a short page is returned. */
async function fetchAllPages(path: string, ctx: RequestContext): Promise<unknown[]> {
  const all: unknown[] = [];
  let startAfter: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: String(ctx.pageSize) });
    if (startAfter) params.set("start_after", startAfter);
    const body = await requestJson(`${path}?${params.toString()}`, ctx);
    if (!Array.isArray(body)) {
      throw new BrewfatherError(`Expected an array from ${path}`);
    }
    all.push(...body);
    if (body.length < ctx.pageSize) break;
    const lastId = extractId(body.at(-1));
    // Stop if there is no cursor to advance, or it failed to move.
    if (!lastId || lastId === startAfter) break;
    startAfter = lastId;
  }
  return all;
}

/** Run `fn` over `items` with a bounded number of concurrent calls. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(limit, 1), items.length) },
    async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await fn(items[index]!);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

async function getInventory(ctx: RequestContext): Promise<InventoryItem[]> {
  const perCategory = await Promise.all(
    INVENTORY_ENDPOINTS.map(async ({ path, category }) => {
      const raw = await fetchAllPages(path, ctx);
      return raw.map((item) => normalizeInventoryItem(item, category));
    })
  );
  return perCategory.flat();
}

async function getRecipes(ctx: RequestContext): Promise<Recipe[]> {
  const raw = await fetchAllPages("/v2/recipes", ctx);
  return raw.map(normalizeRecipeSummary);
}

async function getRecipeDetail(ctx: RequestContext, id: string): Promise<RecipeDetail> {
  const raw = await requestJson(`/v2/recipes/${encodeURIComponent(id)}`, ctx);
  return normalizeRecipeDetail(raw);
}

async function getRecipeDetails(ctx: RequestContext): Promise<RecipeDetail[]> {
  const summaries = await getRecipes(ctx);
  return mapWithConcurrency(summaries, RECIPE_DETAIL_CONCURRENCY, (summary) =>
    getRecipeDetail(ctx, summary.id)
  );
}

async function getData(ctx: RequestContext): Promise<BrewfatherData> {
  const [inventory, recipes] = await Promise.all([
    getInventory(ctx),
    getRecipeDetails(ctx),
  ]);
  return { inventory, recipes };
}

/**
 * Create a Brewfather client. Reads credentials from the environment unless
 * overridden. Throws {@link BrewfatherAuthError} when credentials are missing.
 */
export function createBrewfatherClient(
  options: BrewfatherClientOptions = {}
): BrewfatherClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "createBrewfatherClient is server-only and must not run in the browser."
    );
  }
  const userId = options.userId ?? process.env.BF_USER_ID ?? "";
  const apiKey = options.apiKey ?? process.env.BF_API_KEY ?? "";
  if (!userId || !apiKey) {
    throw new BrewfatherAuthError();
  }
  const ctx: RequestContext = {
    baseUrl: (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    authHeader: buildAuthHeader(userId, apiKey),
    fetchImpl: options.fetchImpl ?? fetch,
    sleep: options.sleep ?? defaultSleep,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    pageSize: clampPageSize(options.pageSize),
  };
  return {
    getInventory: () => getInventory(ctx),
    getRecipes: () => getRecipes(ctx),
    getRecipeDetail: (id: string) => getRecipeDetail(ctx, id),
    getRecipeDetails: () => getRecipeDetails(ctx),
    getData: () => getData(ctx),
  };
}

// ---------------------------------------------------------------------------
// Normalization (raw Brewfather JSON -> frozen contracts). Defensive by design:
// upstream fields are optional/loosely typed, so every read has a fallback.
// ---------------------------------------------------------------------------

type RawRecord = Record<string, unknown>;

function asRecord(value: unknown): RawRecord {
  return typeof value === "object" && value !== null ? (value as RawRecord) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function extractId(value: unknown): string {
  return asString(asRecord(value)._id);
}

/** Default unit per category (Brewfather is metric; recipe/inventory amounts share these). */
function defaultUnitFor(category: IngredientCategory): string {
  switch (category) {
    case "fermentable":
      return "kg";
    case "hop":
      return "g";
    case "yeast":
      return "pkg";
    case "misc":
      return "g";
  }
}

export function normalizeInventoryItem(
  raw: unknown,
  category: IngredientCategory
): InventoryItem {
  const record = asRecord(raw);
  const item: InventoryItem = {
    id: asString(record._id),
    name: asString(record.name),
    category,
    amount: asFiniteNumber(record.inventory) ?? asFiniteNumber(record.amount) ?? 0,
    unit: asString(record.unit) || defaultUnitFor(category),
  };
  if (category === "hop") {
    const alpha = asFiniteNumber(record.alpha);
    if (alpha !== undefined) item.alpha = alpha;
  } else if (category === "fermentable") {
    const color = asFiniteNumber(record.color);
    if (color !== undefined) item.color = color;
  } else if (category === "yeast") {
    const attenuation = asFiniteNumber(record.attenuation);
    if (attenuation !== undefined) item.attenuation = attenuation;
  }
  return item;
}

function extractStyleName(style: unknown): string {
  if (typeof style === "string") return style;
  return asString(asRecord(style).name);
}

export function normalizeRecipeSummary(raw: unknown): Recipe {
  const record = asRecord(raw);
  const recipe: Recipe = {
    id: asString(record._id),
    name: asString(record.name),
  };
  const style = extractStyleName(record.style);
  if (style) recipe.style = style;
  const author = asString(record.author);
  if (author) recipe.author = author;
  const batchSize = asFiniteNumber(record.batchSize);
  if (batchSize !== undefined) recipe.batchSize = batchSize;
  return recipe;
}

function normalizeRecipeIngredient(
  raw: unknown,
  category: IngredientCategory
): RecipeIngredient {
  const record = asRecord(raw);
  return {
    id: asString(record._id),
    name: asString(record.name),
    category,
    amount: asFiniteNumber(record.amount) ?? 0,
    unit: asString(record.unit) || defaultUnitFor(category),
  };
}

export function normalizeRecipeDetail(raw: unknown): RecipeDetail {
  const record = asRecord(raw);
  return {
    ...normalizeRecipeSummary(raw),
    fermentables: asArray(record.fermentables).map((x) =>
      normalizeRecipeIngredient(x, "fermentable")
    ),
    hops: asArray(record.hops).map((x) => normalizeRecipeIngredient(x, "hop")),
    yeasts: asArray(record.yeasts).map((x) => normalizeRecipeIngredient(x, "yeast")),
    miscs: asArray(record.miscs).map((x) => normalizeRecipeIngredient(x, "misc")),
  };
}
