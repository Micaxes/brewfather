import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SyncButton } from "@/components/brew/SyncButton";

// vitest is configured without globals, so register RTL cleanup explicitly.
afterEach(cleanup);

const base = { error: null, onSync: () => {} };

describe("SyncButton", () => {
  it("renders idle with an auto-formatted relative Last synced label", () => {
    const syncedAt = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    render(<SyncButton {...base} syncing={false} syncedAt={syncedAt} />);

    const button = screen.getByRole("button", { name: /sync now/i });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText("Last synced 4 minutes ago")).toBeInTheDocument();
    // Absolute time exposed on hover.
    expect(screen.getByText(/last synced/i)).toHaveAttribute("title");
  });

  it("shows Never synced when no cache row exists", () => {
    render(<SyncButton {...base} syncing={false} syncedAt={null} />);
    expect(screen.getByText("Never synced")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sync now/i })).toBeEnabled();
  });

  it("disables, marks busy, and announces politely while syncing", () => {
    render(<SyncButton {...base} syncing syncedAt={null} />);

    const button = screen.getByRole("button", { name: /syncing/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    // The live region exists and carries the pending announcement.
    expect(screen.getByRole("status")).toHaveTextContent(/syncing/i);
  });

  it("calls onSync on click and ignores clicks while disabled", () => {
    const onSync = vi.fn();
    const { rerender } = render(
      <SyncButton {...base} onSync={onSync} syncing={false} syncedAt={null} />
    );
    fireEvent.click(screen.getByRole("button", { name: /sync now/i }));
    expect(onSync).toHaveBeenCalledTimes(1);

    rerender(<SyncButton {...base} onSync={onSync} syncing syncedAt={null} />);
    fireEvent.click(screen.getByRole("button", { name: /syncing/i }));
    expect(onSync).toHaveBeenCalledTimes(1);
  });

  it("shows the green Synced confirmation and announces it while justSynced", () => {
    const syncedAt = new Date().toISOString();
    render(<SyncButton {...base} syncing={false} justSynced syncedAt={syncedAt} />);

    expect(screen.getByRole("button", { name: "Synced" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Synced");
    // The flash suppresses the countdown while it is visible.
    expect(screen.queryByText(/you can sync again/i)).not.toBeInTheDocument();
  });

  it("disables and counts down while inside the post-sync cooldown", () => {
    const syncedAt = new Date(Date.now() - 10_000).toISOString();
    render(<SyncButton {...base} syncing={false} syncedAt={syncedAt} />);

    expect(screen.getByRole("button", { name: /sync now/i })).toBeDisabled();
    expect(screen.getByText(/you can sync again in \d+s/i)).toBeInTheDocument();
    expect(screen.getByText("Last synced just now")).toBeInTheDocument();
  });

  it("shows a persistent inline error and stays enabled as Retry", () => {
    render(
      <SyncButton
        {...base}
        error="Couldn’t reach Brewfather. Check your API key or retry."
        syncing={false}
        syncedAt={new Date(Date.now() - 10_000).toISOString()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/reach brewfather/i);
    // Error wins over cooldown: the button must stay usable as Retry.
    expect(
      screen.getByRole("button", { name: /sync failed — retry/i })
    ).toBeEnabled();
  });
});
