/**
 * Local mock of the `GET /api/brew-candidates` response, typed to the shared
 * contract. The real route is added at integration (Task 6); until then the
 * dashboard renders against this fixture.
 */
import type { BrewCandidatesResponse } from "@/lib/api-contract";

export const mockBrewCandidates: BrewCandidatesResponse = {
  generatedAt: "2026-06-27T12:00:00.000Z",
  warnings: [],
  candidates: [
    {
      recipe: {
        id: "r-apa",
        name: "American Pale Ale",
        style: "American Pale Ale",
        batchSize: 20,
      },
      bucket: "brew_now",
      score: 1,
      shoppingList: [],
      ingredientMatches: [
        {
          ingredient: { id: "f-marisotter", name: "Maris Otter", category: "fermentable", amount: 5, unit: "kg" },
          matchedBy: "id",
          status: "satisfied",
          have: 10,
          need: 5,
          shortfall: 0,
        },
        {
          ingredient: { id: "h-cascade", name: "Cascade", category: "hop", amount: 50, unit: "g" },
          matchedBy: "id",
          status: "satisfied",
          have: 200,
          need: 50,
          shortfall: 0,
        },
        {
          ingredient: { id: "y-us05", name: "SafAle US-05", category: "yeast", amount: 1, unit: "pkg" },
          matchedBy: "id",
          status: "satisfied",
          have: 2,
          need: 1,
          shortfall: 0,
        },
      ],
    },
    {
      recipe: {
        id: "r-citra-ipa",
        name: "Citra Single Hop IPA",
        style: "American IPA",
        batchSize: 20,
      },
      bucket: "almost",
      score: 0.88,
      shoppingList: [
        { name: "Citra", category: "hop", amount: 50, unit: "g" },
        { name: "Whirlfloc", category: "misc", amount: 1, unit: "each" },
      ],
      ingredientMatches: [
        {
          ingredient: { id: "f-marisotter", name: "Maris Otter", category: "fermentable", amount: 5, unit: "kg" },
          matchedBy: "id",
          status: "satisfied",
          have: 10,
          need: 5,
          shortfall: 0,
        },
        {
          ingredient: { id: "h-citra", name: "Citra", category: "hop", amount: 150, unit: "g" },
          matchedBy: "id",
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
    },
    {
      recipe: {
        id: "r-imperial-stout",
        name: "Imperial Stout",
        style: "Imperial Stout",
        batchSize: 20,
      },
      bucket: "not_yet",
      score: 0.2,
      shoppingList: [],
      ingredientMatches: [
        {
          ingredient: { id: "f-goldenpromise", name: "Golden Promise", category: "fermentable", amount: 8, unit: "kg" },
          status: "missing",
          have: 0,
          need: 8,
          shortfall: 8,
        },
        {
          ingredient: { id: "h-magnum", name: "Magnum", category: "hop", amount: 40, unit: "g" },
          status: "missing",
          have: 0,
          need: 40,
          shortfall: 40,
        },
        {
          ingredient: { id: "y-1084", name: "Wyeast 1084 Irish Ale", category: "yeast", amount: 1, unit: "pkg" },
          status: "missing",
          have: 0,
          need: 1,
          shortfall: 1,
        },
      ],
    },
  ],
};
