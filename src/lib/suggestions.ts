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

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export function suggestRecipes(
  recipes: Recipe[],
  availableIngredients: string[],
  pantryItems: PantryItem[]
): SuggestionResult[] {
  const available = new Set([
    ...availableIngredients.map(normalize),
    ...pantryItems
      .filter((p) => p.isStaple)
      .flatMap((p) => {
        const names = [normalize(p.name)];
        if (p.nameSecondary) names.push(normalize(p.nameSecondary));
        return names;
      }),
  ]);

  const results: SuggestionResult[] = recipes.map((recipe) => {
    const matched: string[] = [];
    const missing: string[] = [];

    for (const ing of recipe.ingredients) {
      const candidates = [normalize(ing.name)];
      if (ing.nameSecondary?.trim()) candidates.push(normalize(ing.nameSecondary));
      const isAvailable = Array.from(available).some((a) =>
        candidates.some((c) => c.includes(a) || a.includes(c))
      );

      if (isAvailable) {
        matched.push(ing.name);
      } else {
        missing.push(ing.name);
      }
    }

    const total = recipe.ingredients.length;
    return {
      recipe,
      matchedCount: matched.length,
      totalCount: total,
      matchPercentage: total > 0 ? Math.round((matched.length / total) * 100) : 0,
      matchedIngredients: matched,
      missingIngredients: missing,
    };
  });

  return results
    .filter((r) => r.matchedCount > 0)
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
}
