/**
 * @vitest-environment node
 *
 * Settings server actions (#23): validate-before-store (an invalid key is
 * never saved), failure-reason → user copy mapping, Test connection, and
 * disconnect. `redirect` is mocked to throw like the real one, so anything
 * after a redirect provably never runs.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string): never => {
    throw new RedirectSignal(url);
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/brewfather/user-credentials", () => ({
  deleteUserBrewfatherCredentials: vi.fn(),
  getUserBrewfatherCredentials: vi.fn(),
  saveUserBrewfatherCredentials: vi.fn(),
  touchBrewfatherValidated: vi.fn(),
  validateBrewfatherCredentials: vi.fn(),
}));

import { revalidatePath } from "next/cache";

import {
  deleteUserBrewfatherCredentials,
  getUserBrewfatherCredentials,
  saveUserBrewfatherCredentials,
  touchBrewfatherValidated,
  validateBrewfatherCredentials,
} from "@/lib/brewfather/user-credentials";
import {
  connectBrewfather,
  disconnectBrewfather,
  testConnection,
} from "../actions";

/** Run an action and return the URL it redirected to. */
async function redirectedTo(action: () => Promise<void>): Promise<string> {
  try {
    await action();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("expected the action to redirect");
}

function form(bfUserId: string, apiKey: string): FormData {
  const data = new FormData();
  data.set("bf_user_id", bfUserId);
  data.set("api_key", apiKey);
  return data;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("connectBrewfather", () => {
  it("never saves a key that fails validation", async () => {
    vi.mocked(validateBrewfatherCredentials).mockResolvedValue({
      ok: false,
      reason: "invalid",
    });

    const url = await redirectedTo(() => connectBrewfather(form("u", "bad-key")));

    expect(url).toContain("error=");
    expect(decodeURIComponent(url)).toMatch(/not your email/i);
    expect(saveUserBrewfatherCredentials).not.toHaveBeenCalled();
    // The submitted key never appears in the redirect URL.
    expect(url).not.toContain("bad-key");
  });

  it("maps a rate limit to wait-and-retry copy without saving", async () => {
    vi.mocked(validateBrewfatherCredentials).mockResolvedValue({
      ok: false,
      reason: "rate_limited",
    });

    const url = await redirectedTo(() => connectBrewfather(form("u", "k")));

    expect(decodeURIComponent(url)).toMatch(/rate-limiting/i);
    expect(saveUserBrewfatherCredentials).not.toHaveBeenCalled();
  });

  it("saves and confirms once validation passes (values trimmed)", async () => {
    vi.mocked(validateBrewfatherCredentials).mockResolvedValue({ ok: true });

    const url = await redirectedTo(() =>
      connectBrewfather(form("  bf-user  ", "  key  "))
    );

    expect(validateBrewfatherCredentials).toHaveBeenCalledWith("bf-user", "key");
    expect(saveUserBrewfatherCredentials).toHaveBeenCalledWith("bf-user", "key");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
    expect(url).toContain("message=");
    expect(decodeURIComponent(url)).toMatch(/verified/i);
  });

  it("rejects empty fields before any Brewfather call", async () => {
    const url = await redirectedTo(() => connectBrewfather(form("", "")));

    expect(decodeURIComponent(url)).toMatch(/both fields are required/i);
    expect(validateBrewfatherCredentials).not.toHaveBeenCalled();
    expect(saveUserBrewfatherCredentials).not.toHaveBeenCalled();
  });

  it("surfaces a storage failure as an error redirect", async () => {
    vi.mocked(validateBrewfatherCredentials).mockResolvedValue({ ok: true });
    vi.mocked(saveUserBrewfatherCredentials).mockRejectedValue(
      new Error("vault unavailable")
    );

    const url = await redirectedTo(() => connectBrewfather(form("u", "k")));

    expect(url).toContain("error=");
    expect(decodeURIComponent(url)).toContain("vault unavailable");
  });
});

describe("testConnection", () => {
  it("re-validates the stored key and refreshes the timestamp", async () => {
    vi.mocked(getUserBrewfatherCredentials).mockResolvedValue({
      userId: "bf-user",
      apiKey: "stored-key",
    });
    vi.mocked(validateBrewfatherCredentials).mockResolvedValue({ ok: true });

    const url = await redirectedTo(() => testConnection());

    expect(validateBrewfatherCredentials).toHaveBeenCalledWith(
      "bf-user",
      "stored-key"
    );
    expect(touchBrewfatherValidated).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(url)).toMatch(/verified/i);
  });

  it("prompts reconnect when the stored key was revoked", async () => {
    vi.mocked(getUserBrewfatherCredentials).mockResolvedValue({
      userId: "bf-user",
      apiKey: "revoked-key",
    });
    vi.mocked(validateBrewfatherCredentials).mockResolvedValue({
      ok: false,
      reason: "invalid",
    });

    const url = await redirectedTo(() => testConnection());

    expect(url).toContain("error=");
    expect(decodeURIComponent(url)).toMatch(/no longer works/i);
    expect(touchBrewfatherValidated).not.toHaveBeenCalled();
    expect(url).not.toContain("revoked-key");
  });

  it("errors when nothing is connected", async () => {
    vi.mocked(getUserBrewfatherCredentials).mockResolvedValue(null);

    const url = await redirectedTo(() => testConnection());

    expect(decodeURIComponent(url)).toMatch(/connect your brewfather account/i);
    expect(validateBrewfatherCredentials).not.toHaveBeenCalled();
  });

  it("still reports success when only the timestamp write fails", async () => {
    vi.mocked(getUserBrewfatherCredentials).mockResolvedValue({
      userId: "bf-user",
      apiKey: "stored-key",
    });
    vi.mocked(validateBrewfatherCredentials).mockResolvedValue({ ok: true });
    vi.mocked(touchBrewfatherValidated).mockRejectedValue(new Error("rpc missing"));

    const url = await redirectedTo(() => testConnection());

    expect(url).toContain("message=");
  });
});

describe("disconnectBrewfather", () => {
  it("deletes the stored credentials (row + Vault secret) and confirms", async () => {
    const url = await redirectedTo(() => disconnectBrewfather());

    expect(deleteUserBrewfatherCredentials).toHaveBeenCalledTimes(1);
    expect(url).toContain("message=");
    expect(decodeURIComponent(url)).toMatch(/disconnected/i);
  });

  it("surfaces a delete failure", async () => {
    vi.mocked(deleteUserBrewfatherCredentials).mockRejectedValue(
      new Error("rpc failed")
    );

    const url = await redirectedTo(() => disconnectBrewfather());

    expect(url).toContain("error=");
  });
});
