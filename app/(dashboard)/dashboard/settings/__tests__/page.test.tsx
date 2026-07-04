/**
 * Settings page (#23): on-page "How to get your Brewfather API key"
 * instructions, connection health (last verified + Test connection), and the
 * Connect / Update key form states.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({
  connectBrewfather: vi.fn(),
  disconnectBrewfather: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock("@/lib/brewfather/user-credentials", () => ({
  getBrewfatherConnection: vi.fn(),
}));

import { getBrewfatherConnection } from "@/lib/brewfather/user-credentials";
import SettingsPage from "../page";

const params = (searchParams: { error?: string; message?: string } = {}) => ({
  searchParams: Promise.resolve(searchParams),
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettingsPage", () => {
  it("shows the full key instructions and a Connect button when not connected", async () => {
    vi.mocked(getBrewfatherConnection).mockResolvedValue({ connected: false });

    render(await SettingsPage(params()));

    // The embedded how-to covers every gotcha from the issue.
    expect(
      screen.getByRole("heading", { name: /how to get your brewfather api key/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/premium/i)).toBeInTheDocument();
    expect(screen.getByText(/settings → api/i)).toBeInTheDocument();
    expect(screen.getByText(/recipes/i)).toBeInTheDocument();
    expect(screen.getByText(/inventory/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not your account email/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/shows it/i)).toHaveTextContent(/once/i);
    expect(screen.getByText(/500 api calls per hour/i)).toBeInTheDocument();

    // External link out to Brewfather's own settings.
    expect(
      screen.getByRole("link", { name: /open brewfather settings/i })
    ).toHaveAttribute("href", "https://web.brewfather.app/tabs/settings");

    // Not connected: the primary action is Connect (not the old "Save & sync").
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.queryByText(/save & sync/i)).not.toBeInTheDocument();
    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /test connection/i })
    ).not.toBeInTheDocument();
  });

  it("shows connection health, Test connection, Update key and Disconnect when connected", async () => {
    vi.mocked(getBrewfatherConnection).mockResolvedValue({
      connected: true,
      bfUserId: "bf-user",
      lastValidatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });

    render(await SettingsPage(params()));

    expect(screen.getByText(/connected as/i)).toBeInTheDocument();
    expect(screen.getByText(/“bf-user”/)).toBeInTheDocument();
    expect(screen.getByText(/key verified 5 minutes ago/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /test connection/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update key/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument();
    // The stored key is never rendered back — only a masked placeholder.
    expect(screen.getByPlaceholderText(/enter to replace/i)).toHaveValue("");
  });

  it("prompts a first verification when the connection predates validation", async () => {
    vi.mocked(getBrewfatherConnection).mockResolvedValue({
      connected: true,
      bfUserId: "bf-user",
      lastValidatedAt: null,
    });

    render(await SettingsPage(params()));

    expect(screen.getByText(/key not verified yet/i)).toBeInTheDocument();
  });

  it("renders error and message banners from the redirect params", async () => {
    vi.mocked(getBrewfatherConnection).mockResolvedValue({ connected: false });

    render(
      await SettingsPage(params({ error: "That key didn’t work." }))
    );

    expect(screen.getByText("That key didn’t work.")).toBeInTheDocument();
  });
});
