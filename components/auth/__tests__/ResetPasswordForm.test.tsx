import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updatePassword = vi.fn();

vi.mock("@/app/reset-password/actions", () => ({
  updatePassword: (...args: unknown[]) => updatePassword(...args),
}));

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

function fields() {
  return {
    password: screen.getByLabelText("New password"),
    confirm: screen.getByLabelText("Confirm new password"),
    submit: screen.getByRole("button", { name: "Set new password" }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  updatePassword.mockResolvedValue({});
});

afterEach(cleanup);

describe("ResetPasswordForm", () => {
  it("submits both values to the action", async () => {
    render(<ResetPasswordForm />);
    const { password, confirm, submit } = fields();

    fireEvent.change(password, { target: { value: "hunter2024" } });
    fireEvent.change(confirm, { target: { value: "hunter2024" } });
    fireEvent.click(submit);

    await vi.waitFor(() =>
      expect(updatePassword).toHaveBeenCalledWith("hunter2024", "hunter2024")
    );
  });

  it("renders the error the action returns", async () => {
    updatePassword.mockResolvedValue({ error: "Those passwords don’t match." });
    render(<ResetPasswordForm />);
    const { password, confirm, submit } = fields();

    fireEvent.change(password, { target: { value: "hunter2024" } });
    fireEvent.change(confirm, { target: { value: "hunter2025" } });
    fireEvent.click(submit);

    expect(
      await screen.findByText("Those passwords don’t match.")
    ).toBeInTheDocument();
  });

  it("renders a server-supplied initial error", () => {
    render(<ResetPasswordForm initialError="That link has expired." />);

    expect(screen.getByText("That link has expired.")).toBeInTheDocument();
  });

  it("uses new-password autocomplete on both fields", () => {
    render(<ResetPasswordForm />);
    const { password, confirm } = fields();

    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(confirm).toHaveAttribute("autocomplete", "new-password");
  });
});
