/**
 * Card structure after the collapse (issue #39): a scannable summary, the
 * detail behind a native disclosure, and the heading kept outside it.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RecipeMatch } from "@/lib/api-contract";
import { RecipeCard } from "@/components/brew/RecipeCard";

afterEach(cleanup);

const match: RecipeMatch = {
  recipe: { id: "r1", name: "Verdant IPA", style: "Hazy IPA", batchSize: 19 },
  bucket: "almost",
  score: 0.89,
  shoppingList: [
    { name: "Cara Blond", category: "fermentable", amount: 0.222, unit: "kg" },
  ],
  ingredientMatches: [
    {
      ingredient: { id: "f1", name: "Pale Malt", category: "fermentable", amount: 4, unit: "kg" },
      status: "satisfied",
      have: 10,
      need: 4,
      shortfall: 0,
    },
    {
      ingredient: { id: "f2", name: "Cara Blond", category: "fermentable", amount: 0.222, unit: "kg" },
      status: "missing",
      have: 0,
      need: 0.222,
      shortfall: 0.222,
    },
    {
      ingredient: { id: "f3", name: "Chateau Vienna", category: "fermentable", amount: 0.75, unit: "kg" },
      status: "satisfied",
      matchedBy: "equivalent",
      inventoryItem: { id: "i9", name: "Vienna Malt", category: "fermentable", amount: 3.3, unit: "kg" },
      have: 3.3,
      need: 0.75,
      shortfall: 0,
      substitutes: [
        {
          inventoryItem: { id: "i9", name: "Vienna Malt", category: "fermentable", amount: 3.3, unit: "kg" },
          have: 3.3,
          coversNeed: true,
          doseFactor: 1,
          justification: "Same equivalence row as Chateau Vienna.",
        },
      ],
    },
  ],
};

describe("RecipeCard", () => {
  it("shows identity, score and a verdict without expanding", () => {
    render(<RecipeCard match={match} />);

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Verdant IPA");
    expect(screen.getByText("Hazy IPA · 19 L")).toBeInTheDocument();
    expect(screen.getByText("89%")).toBeInTheDocument();
    expect(screen.getByText("1 to buy")).toBeInTheDocument();
  });

  it("puts the detail behind a closed disclosure", () => {
    const { container } = render(<RecipeCard match={match} />);
    const details = container.querySelector("details");

    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(
      screen.getByText(/Ingredients & substitutions/)
    ).toBeInTheDocument();
  });

  it("keeps the recipe heading outside the summary", () => {
    // WebKit exposes <summary> as a disclosure triangle, and a heading nested
    // inside one stops being discoverable — the heading list is the
    // screen-reader user's scanning surface, so it stays out.
    const { container } = render(<RecipeCard match={match} />);
    const summary = container.querySelector("summary");

    expect(summary?.querySelector("h3")).toBeNull();
    expect(container.querySelector("h3")).not.toBeNull();
  });

  it("surfaces the blocker on the summary, not just inside the detail", () => {
    const { container } = render(<RecipeCard match={match} />);
    const summaryRegion = container.querySelector("article > div");

    expect(summaryRegion?.textContent).toContain("Cara Blond");
  });

  it("shows a substituted line resolved to the malt actually used", () => {
    const { container } = render(<RecipeCard match={match} />);
    const summaryRegion = container.querySelector("article > div");

    expect(summaryRegion?.textContent).toContain("Chateau Vienna");
    expect(summaryRegion?.textContent).toContain("→ Vienna Malt");
  });

  it("does not repeat satisfied ingredients in the summary", () => {
    const { container } = render(<RecipeCard match={match} />);
    const summaryRegion = container.querySelector("article > div");

    expect(summaryRegion?.textContent).not.toContain("Pale Malt");
  });
});
