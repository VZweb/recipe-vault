import type { Recipe } from "@/types/recipe";
import type { PantryItem } from "@/types/pantry";
import { ingredientLinkKey, ingredientLineLinkKeys } from "@/lib/ingredientRef";

export interface SuggestionResult {
  recipe: Recipe;
  matchedCount: number;
  totalCount: number;
  matchPercentage: number;
  matchedIngredients: string[];
  missingIngredients: string[];
}

export function suggestRecipes(
  recipes: Recipe[],
  pantryItems: PantryItem[]
): SuggestionResult[] {
  const allLinkKeys = new Set(
    pantryItems
      .map((p) => ingredientLinkKey(p.masterIngredientId, p.masterIngredientScope))
      .filter((k): k is string => k !== null)
  );

  const results: SuggestionResult[] = recipes.map((recipe) => {
    const matched: string[] = [];
    const missing: string[] = [];

    for (const ing of recipe.ingredients) {
      if (ing.isSection) continue;
      const keys = ingredientLineLinkKeys(ing);
      const anyMatch = keys.some((k) => allLinkKeys.has(k));
      if (anyMatch) {
        matched.push(ing.name);
      } else {
        missing.push(ing.name);
      }
    }

    const total = recipe.ingredients.filter((i) => !i.isSection).length;
    return {
      recipe,
      matchedCount: matched.length,
      totalCount: total,
      matchPercentage:
        total > 0 ? Math.round((matched.length / total) * 100) : 0,
      matchedIngredients: matched,
      missingIngredients: missing,
    };
  });

  return results
    .filter((r) => r.matchedCount > 0)
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
}
