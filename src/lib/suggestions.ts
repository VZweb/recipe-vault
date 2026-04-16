import type { Recipe } from "@/types/recipe";
import type { PantryItem } from "@/types/pantry";
import { normalizeText } from "@/lib/normalize";

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
  availableIngredients: string[],
  pantryItems: PantryItem[]
): SuggestionResult[] {
  const availableMasterIds = new Set(
    pantryItems.map((p) => p.masterIngredientId).filter(Boolean)
  );

  const stapleIds = new Set(
    pantryItems
      .filter((p) => p.isStaple && p.masterIngredientId)
      .map((p) => p.masterIngredientId!)
  );

  const available = new Set([
    ...availableIngredients.map(normalizeText),
    ...pantryItems
      .filter((p) => p.isStaple)
      .flatMap((p) => {
        const names = [normalizeText(p.name)];
        if (p.nameSecondary) names.push(normalizeText(p.nameSecondary));
        return names;
      }),
  ]);

  const allMasterIds = new Set([...availableMasterIds, ...stapleIds]);

  const results: SuggestionResult[] = recipes.map((recipe) => {
    const matched: string[] = [];
    const missing: string[] = [];

    for (const ing of recipe.ingredients) {
      if (ing.isSection) continue;
      if (ing.masterIngredientId && allMasterIds.has(ing.masterIngredientId)) {
        matched.push(ing.name);
        continue;
      }

      const candidates = [normalizeText(ing.name)];
      if (ing.nameSecondary?.trim())
        candidates.push(normalizeText(ing.nameSecondary));
      const isAvailable = Array.from(available).some((a) =>
        candidates.some((c) => c.includes(a) || a.includes(c))
      );

      if (isAvailable) {
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
