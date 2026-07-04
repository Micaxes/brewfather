import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BrewCandidatesResponse } from "@/lib/api-contract";
import { DashboardClient } from "@/app/(dashboard)/dashboard/DashboardClient";
import { mockBrewCandidates } from "@/app/(dashboard)/dashboard/mock-brew-candidates";

// vitest runs without globals, so register RTL cleanup explicitly.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function stubFetch(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response)
  );
}

describe("DashboardClient", () => {
  it("fetches and renders the three buckets and their recipes", async () => {
    stubFetch(jsonResponse(mockBrewCandidates));

    render(<DashboardClient />);

    // Loading state shows first.
    expect(screen.getByText(/loading brew candidates/i)).toBeInTheDocument();

    // After the fetch resolves, the three buckets and recipes render.
    expect(
      await screen.findByRole("heading", { level: 2, name: /brew now/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /almost/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /not yet/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "American Pale Ale" })
    ).toBeInTheDocument();

    // The header exposes the manual sync control + last-synced line.
    expect(screen.getByRole("button", { name: /sync now/i })).toBeEnabled();
    expect(screen.getByText(/last synced/i)).toBeInTheDocument();
  });

  it("shows the error state when the request fails", async () => {
    stubFetch(new Response("upstream error", { status: 502 }));

    render(<DashboardClient />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("Sync now re-fetches with ?refresh=true and updates the dashboard in place", async () => {
    const refreshed: BrewCandidatesResponse = {
      ...mockBrewCandidates,
      syncedAt: new Date().toISOString(),
      warnings: ["Fresh from manual sync"],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(mockBrewCandidates))
      .mockResolvedValueOnce(jsonResponse(refreshed));
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardClient />);
    const button = await screen.findByRole("button", { name: /sync now/i });

    fireEvent.click(button);

    // The refreshed response replaces the dashboard data in place.
    expect(await screen.findByText("Fresh from manual sync")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/brew-candidates");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/brew-candidates?refresh=true"
    );

    // Success flash, and "Last synced" resets from the fresh server syncedAt.
    expect(screen.getByRole("button", { name: "Synced" })).toBeInTheDocument();
    expect(screen.getByText("Last synced just now")).toBeInTheDocument();
  });

  it("keeps the last-good data visible and shows an inline error when a sync fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(mockBrewCandidates))
      .mockResolvedValueOnce(new Response("boom", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardClient />);
    const button = await screen.findByRole("button", { name: /sync now/i });

    fireEvent.click(button);

    // Persistent inline error near the button…
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/reach brewfather/i);
    // …the button becomes Retry and stays enabled…
    expect(
      screen.getByRole("button", { name: /sync failed — retry/i })
    ).toBeEnabled();
    // …and the last-good candidates are still on screen (no blanking).
    expect(
      screen.getByRole("heading", { level: 3, name: "American Pale Ale" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/couldn’t load your brew board/i)
    ).not.toBeInTheDocument();
  });

  it("shows the cooldown instead of claiming Synced when the server rejects the refresh", async () => {
    const rejected: BrewCandidatesResponse = {
      ...mockBrewCandidates,
      syncedAt: new Date(Date.now() - 10_000).toISOString(),
      cooldownSeconds: 50,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(mockBrewCandidates))
      .mockResolvedValueOnce(jsonResponse(rejected));
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardClient />);
    fireEvent.click(await screen.findByRole("button", { name: /sync now/i }));

    // The countdown surfaces (computed from the server syncedAt)…
    expect(
      await screen.findByText(/you can sync again in \d+s/i)
    ).toBeInTheDocument();
    // …the button is locked out, and no success is claimed.
    expect(screen.getByRole("button", { name: /sync now/i })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Synced" })
    ).not.toBeInTheDocument();
  });

  it("collapses rapid double-clicks into a single in-flight request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(mockBrewCandidates))
      // Second call never settles, keeping the sync in flight.
      .mockImplementationOnce(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<DashboardClient />);
    const button = await screen.findByRole("button", { name: /sync now/i });

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    // Initial load + exactly one refresh, despite three clicks.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole("button", { name: /syncing/i })
    ).toBeDisabled();
  });
});
