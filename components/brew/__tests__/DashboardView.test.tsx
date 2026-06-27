import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { BrewCandidatesResponse, RecipeMatch } from "@/lib/api-contract";
import { DashboardView } from "@/components/brew/DashboardView";

// vitest is configured without globals, so register RTL cleanup explicitly.
afterEach(cleanup);

function recipeMatch(
  id: string,
  name: string,
  bucket: RecipeMatch["bucket"],
  extra: Partial<RecipeMatch> = {}
): RecipeMatch {
  return {
    recipe: { id, name },
    bucket,
    score: extra.score ?? 1,
    ingredientMatches: extra.ingredientMatches ?? [],
    shoppingList: extra.shoppingList ?? [],
  };
}

const populated: BrewCandidatesResponse = {
  generatedAt: "2026-06-27T12:00:00.000Z",
  warnings: [],
  candidates: [
    recipeMatch("r-apa", "American Pale Ale", "brew_now", {
      ingredientMatches: [
        {
          ingredient: { id: "f1", name: "Maris Otter", category: "fermentable", amount: 5, unit: "kg" },
          status: "satisfied",
          have: 10,
          need: 5,
          shortfall: 0,
        },
      ],
    }),
    recipeMatch("r-ipa", "Citra Single Hop IPA", "almost", {
      score: 0.88,
      ingredientMatches: [
        {
          ingredient: { id: "h1", name: "Citra", category: "hop", amount: 150, unit: "g" },
          status: "short",
          have: 100,
          need: 150,
          shortfall: 50,
        },
        {
          ingredient: { id: "", name: "Whirlfloc", category: "misc", amount: 1, unit: "each" },
          status: "missing",
          have: 0,
          need: 1,
          shortfall: 1,
        },
      ],
      shoppingList: [
        { name: "Citra", category: "hop", amount: 50, unit: "g" },
        { name: "Whirlfloc", category: "misc", amount: 1, unit: "each" },
      ],
    }),
    recipeMatch("r-stout", "Imperial Stout", "not_yet", {
      score: 0.2,
      ingredientMatches: [
        {
          ingredient: { id: "f2", name: "Golden Promise", category: "fermentable", amount: 8, unit: "kg" },
          status: "missing",
          have: 0,
          need: 8,
          shortfall: 8,
        },
      ],
    }),
  ],
};

describe("DashboardView", () => {
  it("renders the three buckets in order with their recipes", () => {
    render(<DashboardView state={{ status: "ready", data: populated }} />);

    expect(
      screen.getByRole("heading", { level: 1, name: /what can i brew now/i })
    ).toBeInTheDocument();

    const sections = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent ?? "");
    expect(sections[0]).toMatch(/Brew now/);
    expect(sections[1]).toMatch(/Almost/);
    expect(sections[2]).toMatch(/Not yet/);

    expect(screen.getByText("American Pale Ale")).toBeInTheDocument();
    expect(screen.getByText("Citra Single Hop IPA")).toBeInTheDocument();
    expect(screen.getByText("Imperial Stout")).toBeInTheDocument();
  });

  it("shows matched / short / missing ingredient states and the score", () => {
    render(<DashboardView state={{ status: "ready", data: populated }} />);

    expect(screen.getByText("In stock:")).toBeInTheDocument();
    expect(screen.getByText("Short:")).toBeInTheDocument();
    expect(screen.getAllByText("Missing:").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("renders a per-recipe shopping list for almost recipes", () => {
    render(<DashboardView state={{ status: "ready", data: populated }} />);

    expect(screen.getByText("Shopping list")).toBeInTheDocument();
    // The 50 g shortfall only appears in the shopping list.
    expect(screen.getByText("50 g")).toBeInTheDocument();
  });

  it("shows the onboarding empty state when there are no candidates", () => {
    const empty: BrewCandidatesResponse = {
      generatedAt: "2026-06-27T12:00:00.000Z",
      warnings: [],
      candidates: [],
    };
    render(<DashboardView state={{ status: "ready", data: empty }} />);

    expect(
      screen.getByRole("heading", { name: /no brew candidates yet/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/BF_USER_ID/)).toBeInTheDocument();
    expect(screen.queryByText("Brew now")).not.toBeInTheDocument();
  });

  it("renders a loading state", () => {
    render(<DashboardView state={{ status: "loading" }} />);
    expect(screen.getByText(/loading brew candidates/i)).toBeInTheDocument();
  });

  it("renders an error state with the provided message", () => {
    render(<DashboardView state={{ status: "error", message: "Upstream is down" }} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Upstream is down");
  });

  it("surfaces warnings when present", () => {
    const withWarning: BrewCandidatesResponse = {
      ...populated,
      warnings: ["Heads up: could not compare units for Lactose."],
    };
    render(<DashboardView state={{ status: "ready", data: withWarning }} />);
    expect(
      screen.getByText(/could not compare units for lactose/i)
    ).toBeInTheDocument();
  });
});
