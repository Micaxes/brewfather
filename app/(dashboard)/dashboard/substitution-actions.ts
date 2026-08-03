"use server";

import {
  acceptSubstitution,
  ingredientKey,
  revokeSubstitution,
} from "@/lib/brewfather/accepted-substitutions";
import type { IngredientCategory } from "@/lib/brewfather/types";

const MESSAGES = {
  unauthenticated: "You are signed out. Sign in and try again.",
  not_migrated:
    "Accepted substitutions need one more database migration — run supabase/migrations/0005_accepted_substitutions.sql.",
  failed: "Could not save that. Please try again.",
} as const;

/**
 * Accept a stand-in for one ingredient of one recipe.
 *
 * Returns `{ error }` for the client to render, matching the convention in
 * `app/login/actions.ts`. The caller refetches `/api/brew-candidates`
 * afterwards so readiness recalculates with the acceptance applied.
 */
export async function acceptSubstitutionAction(input: {
  recipeId: string;
  category: IngredientCategory;
  ingredientName: string;
  inventoryItemId: string;
  inventoryItemName: string;
}): Promise<{ error?: string }> {
  const result = await acceptSubstitution({
    recipeId: input.recipeId,
    ingredientKey: ingredientKey(input.category, input.ingredientName),
    inventoryItemId: input.inventoryItemId,
    inventoryItemName: input.inventoryItemName,
  });
  return result.ok ? {} : { error: MESSAGES[result.reason] };
}

/** Undo an acceptance, returning the line to whatever the engine infers. */
export async function revokeSubstitutionAction(input: {
  recipeId: string;
  category: IngredientCategory;
  ingredientName: string;
}): Promise<{ error?: string }> {
  const result = await revokeSubstitution(
    input.recipeId,
    ingredientKey(input.category, input.ingredientName)
  );
  return result.ok ? {} : { error: MESSAGES[result.reason] };
}
