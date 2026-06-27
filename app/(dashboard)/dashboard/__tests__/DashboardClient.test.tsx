import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "@/app/(dashboard)/dashboard/DashboardClient";
import { mockBrewCandidates } from "@/app/(dashboard)/dashboard/mock-brew-candidates";

// vitest runs without globals, so register RTL cleanup explicitly.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response)
  );
}

describe("DashboardClient", () => {
  it("fetches and renders the three buckets and their recipes", async () => {
    stubFetch(
      new Response(JSON.stringify(mockBrewCandidates), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

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
  });

  it("shows the error state when the request fails", async () => {
    stubFetch(new Response("upstream error", { status: 502 }));

    render(<DashboardClient />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
