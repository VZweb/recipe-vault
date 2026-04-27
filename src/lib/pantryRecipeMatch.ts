import type { Ingredient, Recipe } from "@/types/recipe";
import type { PantryItem } from "@/types/pantry";
import {
  ingredientLineLinkKeys,
  ingredientLinkKey,
  pantryLinkKey,
} from "@/lib/ingredientRef";

export type CookPantryMatchKind = "primary" | "substitute";

export interface CookPantryQueueEntry {
  ingredient: Ingredient;
  pantryItem: PantryItem;
  matchKind: CookPantryMatchKind;
}

export function findPantryItemForIngredient(
  ing: Ingredient,
  pantryItems: PantryItem[]
): PantryItem | undefined {
  const keys = new Set(ingredientLineLinkKeys(ing));
  return pantryItems.find((p) => {
    const k = pantryLinkKey(p);
    return k && keys.has(k);
  });
}

function pantryKeySet(pantryItems: PantryItem[]): Set<string> {
  return new Set(
    pantryItems
      .map((p) => pantryLinkKey(p))
      .filter((k): k is string => k !== null)
  );
}

function ingredientInPantry(ing: Ingredient, pantryKeys: Set<string>): boolean {
  if (ing.isSection) return false;
  return ingredientLineLinkKeys(ing).some((k) => pantryKeys.has(k));
}

function matchKindForIngredient(
  ing: Ingredient,
  pantryKeys: Set<string>
): CookPantryMatchKind {
  const primary = ingredientLinkKey(ing.masterIngredientId, ing.masterIngredientScope);
  if (primary && pantryKeys.has(primary)) return "primary";
  return "substitute";
}

/**
 * Recipe ingredients that appear in the pantry, in recipe order.
 * Deduplicates by pantry row id so one pack is not stepped twice if two lines resolve to it.
 */
export function buildCookPantryQueue(
  recipe: Pick<Recipe, "ingredients">,
  pantryItems: PantryItem[]
): CookPantryQueueEntry[] {
  const pantryKeys = pantryKeySet(pantryItems);
  const sorted = [...recipe.ingredients]
    .filter((ing) => ingredientInPantry(ing, pantryKeys))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const out: CookPantryQueueEntry[] = [];
  const seenPantryIds = new Set<string>();

  for (const ing of sorted) {
    const pantryItem = findPantryItemForIngredient(ing, pantryItems);
    if (!pantryItem || seenPantryIds.has(pantryItem.id)) continue;
    seenPantryIds.add(pantryItem.id);
    out.push({
      ingredient: ing,
      pantryItem,
      matchKind: matchKindForIngredient(ing, pantryKeys),
    });
  }

  return out;
}
