import { cleanup, render, screen, within } from "@testing-library/react";
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

const CRYSTAL = {
  id: "inv-1",
  name: "Crisp Crystal 120",
  category: "fermentable" as const,
  amount: 5,
  unit: "kg",
};

/** A missing malt carrying ranked in-inventory stand-ins. */
const withSubstitutes: IngredientMatch = {
  ingredient: {
    id: "f9",
    name: "Weyermann Caramunich Type 2",
    category: "fermentable",
    amount: 1,
    unit: "kg",
  },
  status: "missing",
  have: 0,
  need: 1,
  shortfall: 1,
  substitutes: [
    {
      inventoryItem: CRYSTAL,
      have: 5,
      coversNeed: true,
      doseFactor: 1,
      justification: "The guide lists this on the same equivalence row.",
    },
    {
      inventoryItem: { ...CRYSTAL, id: "inv-2", name: "Château Special B", amount: 0.2 },
      have: 0.2,
      coversNeed: false,
      doseFactor: 0.85,
      justification: "Both are caramel/crystal malts and the colour is close.",
    },
  ],
};

describe("IngredientList — malt substitutions", () => {
  it("lists each substitute with its justification", () => {
    render(<IngredientList matches={[withSubstitutes]} />);

    expect(screen.getByText("Crisp Crystal 120")).toBeInTheDocument();
    expect(
      screen.getByText(/same equivalence row/i)
    ).toBeInTheDocument();
    expect(screen.getByText("5 kg on hand")).toBeInTheDocument();
  });

  it("distinguishes a covering substitute from a partial one", () => {
    render(<IngredientList matches={[withSubstitutes]} />);

    expect(screen.getByText("covers it")).toBeInTheDocument();
    expect(screen.getByText("partial")).toBeInTheDocument();
  });

  it("surfaces the -15% dose adjustment for dark colourants", () => {
    render(<IngredientList matches={[withSubstitutes]} />);
    expect(screen.getByText(/Use about 85% of the listed amount/)).toBeInTheDocument();
  });

  it("says a line was satisfied by a stand-in rather than the real malt", () => {
    render(
      <IngredientList
        matches={[
          {
            ...withSubstitutes,
            status: "satisfied",
            matchedBy: "equivalent",
            inventoryItem: CRYSTAL,
            have: 5,
            shortfall: 0,
          },
        ]}
      />
    );

    expect(screen.getByText(/Substituted from your inventory/i)).toBeInTheDocument();
    expect(screen.getByText("using this")).toBeInTheDocument();
    expect(screen.getByText("In stock via substitute:")).toBeInTheDocument();
  });

  it("shows nothing extra for an ingredient with no substitutes", () => {
    render(<IngredientList matches={matches} />);
    expect(screen.queryByText(/substitutes in your inventory/i)).not.toBeInTheDocument();
  });

  // Sighted users read the group from the indent and the caption above it; a
  // screen reader only gets that structure if the nested list carries a name
  // that says which malt these stand-ins are for.
  it("names the substitute list after the ingredient it belongs to", () => {
    render(<IngredientList matches={[withSubstitutes]} />);

    const substituteList = screen.getByRole("list", {
      name: "Substitutes in your inventory for Weyermann Caramunich Type 2",
    });
    expect(within(substituteList).getAllByRole("listitem")).toHaveLength(2);
  });

  it("names the list after the stand-in actually in use when substituted", () => {
    render(
      <IngredientList
        matches={[
          {
            ...withSubstitutes,
            status: "satisfied",
            matchedBy: "equivalent",
            inventoryItem: CRYSTAL,
            have: 5,
            shortfall: 0,
          },
        ]}
      />
    );

    expect(
      screen.getByRole("list", {
        name: "Substituted from your inventory for Weyermann Caramunich Type 2",
      })
    ).toBeInTheDocument();
  });

  it("does not announce the caption twice", () => {
    render(<IngredientList matches={[withSubstitutes]} />);

    // The visible caption duplicates the list's accessible name, so it is
    // hidden from assistive tech rather than read out ahead of it.
    expect(screen.getByText("Substitutes in your inventory")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
