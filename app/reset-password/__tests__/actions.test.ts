/**
 * @vitest-environment node
 *
 * The set-a-new-password action. `redirect` is mocked to throw like the real
 * one, so anything after a redirect provably never runs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const getUser = vi.fn();
const updateUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser, updateUser } })),
}));

import { revalidatePath } from "next/cache";

import { EXPIRED_SESSION_MESSAGE } from "@/lib/auth/password";
import { updatePassword } from "../actions";

/** Run the action and return the URL it redirected to. */
async function redirectedTo(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("expected the action to redirect");
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.co" } } });
  updateUser.mockResolvedValue({ error: null });
});

describe("updatePassword", () => {
  it("saves the new password and lands the user in the dashboard", async () => {
    const url = await redirectedTo(() =>
      updatePassword("hunter2024", "hunter2024")
    );

    expect(updateUser).toHaveBeenCalledWith({ password: "hunter2024" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(url).toBe("/dashboard");
  });

  it("rejects a password shorter than the minimum without calling Supabase", async () => {
    const res = await updatePassword("abc", "abc");

    expect(res.error).toMatch(/at least 6 characters/);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation without calling Supabase", async () => {
    const res = await updatePassword("hunter2024", "hunter2025");

    expect(res.error).toMatch(/don’t match/);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("reports an expired recovery session instead of silently succeeding", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await updatePassword("hunter2024", "hunter2024");

    expect(res.error).toBe(EXPIRED_SESSION_MESSAGE);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("surfaces a Supabase rejection rather than redirecting", async () => {
    updateUser.mockResolvedValue({
      error: { message: "New password should be different from the old password." },
    });

    const res = await updatePassword("hunter2024", "hunter2024");

    expect(res.error).toMatch(/should be different/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
