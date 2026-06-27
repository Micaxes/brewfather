import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { IngredientMatch } from "@/lib/matcher/types";
import { IngredientList } from "@/components/brew/IngredientList";

// vitest is configured without globals, so register RTL cleanup explicitly.
afterEach(cleanup);

const matches: IngredientMatch[] = [
  {
    ingredient: { id: "f1", name: "Maris Otter", category: "fermentable", amount: 5, unit: "kg" },
    status: "satisfied",
    have: 10,
    need: 5,
    shortfall: 0,
  },
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
];

describe("IngredientList", () => {
  it("renders each ingredient with its availability detail", () => {
    render(<IngredientList matches={matches} />);

    expect(screen.getByText("Maris Otter")).toBeInTheDocument();
    expect(screen.getByText("5 kg")).toBeInTheDocument(); // satisfied -> requirement
    expect(screen.getByText("100 g of 150 g")).toBeInTheDocument(); // short -> have of need
    expect(screen.getByText("need 1 each")).toBeInTheDocument(); // missing -> need
  });

  it("handles an empty ingredient list", () => {
    render(<IngredientList matches={[]} />);
    expect(screen.getByText(/no ingredients listed/i)).toBeInTheDocument();
  });
});
