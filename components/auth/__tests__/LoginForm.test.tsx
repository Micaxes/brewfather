/**
 * Covers the "Forgot password?" path added alongside the reset flow. The rest
 * of LoginForm predates this file and remains untested.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const checkEmail = vi.fn();
const resetPasswordForEmail = vi.fn();

vi.mock("@/app/login/actions", () => ({
  checkEmail: (...args: unknown[]) => checkEmail(...args),
  passwordSignIn: vi.fn(),
  signUpWithPassword: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: (...args: unknown[]) =>
        resetPasswordForEmail(...args),
      signInWithOAuth: vi.fn(),
    },
  }),
}));

import { LoginForm } from "@/components/auth/LoginForm";

/** Drive the email step for an existing account so the password step renders. */
async function reachPasswordStep(email = "brewer@example.com") {
  render(<LoginForm />);
  // Queried by placeholder, not label: LoginForm's labels carry no `htmlFor`
  // and don't wrap their inputs, so they aren't programmatically associated.
  fireEvent.change(screen.getByPlaceholderText("you@brewhaus.co"), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  return screen.findByRole("button", { name: "Forgot password?" });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkEmail.mockResolvedValue({ exists: true });
  resetPasswordForEmail.mockResolvedValue({ error: null });
});

afterEach(cleanup);

describe("LoginForm — forgot password", () => {
  it("sends a reset email pointed at the recovery landing route", async () => {
    const button = await reachPasswordStep();
    fireEvent.click(button);

    await vi.waitFor(() =>
      expect(resetPasswordForEmail).toHaveBeenCalledWith(
        "brewer@example.com",
        expect.objectContaining({
          redirectTo: expect.stringContaining("/auth/callback?next=/reset-password"),
        })
      )
    );
  });

  it("confirms the send instead of leaving the user guessing", async () => {
    const button = await reachPasswordStep();
    fireEvent.click(button);

    expect(
      await screen.findByText(/Reset link sent to brewer@example\.com/)
    ).toBeInTheDocument();
  });

  it("translates Supabase's rate-limit error into actionable copy", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { message: "For security purposes, email rate limit exceeded" },
    });
    const button = await reachPasswordStep();
    fireEvent.click(button);

    expect(
      await screen.findByText(/Wait an hour and try again/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Reset link sent/)).not.toBeInTheDocument();
  });

  it("is not offered on the create-account step", async () => {
    checkEmail.mockResolvedValue({ exists: false });
    render(<LoginForm />);
    // Queried by placeholder, not label: LoginForm's labels carry no `htmlFor`
  // and don't wrap their inputs, so they aren't programmatically associated.
  fireEvent.change(screen.getByPlaceholderText("you@brewhaus.co"), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByRole("button", { name: "Create account" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Forgot password?" })
    ).not.toBeInTheDocument();
  });
});
