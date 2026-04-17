import type { Recipe } from "@/types/recipe";
import type { PantryItem } from "@/types/pantry";

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
  const allMasterIds = new Set(
    pantryItems.map((p) => p.masterIngredientId).filter(Boolean)
  );

  const results: SuggestionResult[] = recipes.map((recipe) => {
    const matched: string[] = [];
    const missing: string[] = [];

    for (const ing of recipe.ingredients) {
      if (ing.isSection) continue;
      if (ing.masterIngredientId && allMasterIds.has(ing.masterIngredientId)) {
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
