import type { Ingredient } from "@/types/recipe";
import type { PantryItem } from "@/types/pantry";
import type { MasterIngredient } from "@/types/ingredient";
import type { MasterIngredientScope } from "@/types/ingredientRef";

/** Firestore path: catalog → ingredientCatalog; otherwise users/{uid}/customIngredients */
export function masterScopeFromMasterIngredient(
  mi: MasterIngredient
): "catalog" | "custom" {
  return mi.isCatalog === false ? "custom" : "catalog";
}

/**
 * Stable key for matching recipe lines to pantry (and extras) across catalog vs custom.
 * Legacy rows (scope null) use a dedicated bucket so they still match each other by id alone.
 */
export function ingredientLinkKey(
  masterIngredientId: string | null | undefined,
  masterIngredientScope: MasterIngredientScope
): string | null {
  const id = masterIngredientId?.trim();
  if (!id) return null;
  if (masterIngredientScope === "catalog") return `c:${id}`;
  if (masterIngredientScope === "custom") return `u:${id}`;
  return `?:${id}`;
}

export function resolveMasterIngredient(
  masterIngredientId: string | null | undefined,
  masterIngredientScope: MasterIngredientScope,
  masters: MasterIngredient[]
): MasterIngredient | undefined {
  const id = masterIngredientId?.trim();
  if (!id) return undefined;
  if (masterIngredientScope === "catalog") {
    return masters.find((m) => m.id === id && m.isCatalog === true);
  }
  if (masterIngredientScope === "custom") {
    return masters.find((m) => m.id === id && m.isCatalog === false);
  }
  return (
    masters.find((m) => m.id === id && m.isCatalog === true) ??
    masters.find((m) => m.id === id && m.isCatalog === false)
  );
}

export function pantryLinkKey(item: Pick<PantryItem, "masterIngredientId" | "masterIngredientScope">): string | null {
  return ingredientLinkKey(item.masterIngredientId, item.masterIngredientScope);
}

export function recipeIngredientLinkKey(
  ing: Pick<Ingredient, "masterIngredientId" | "masterIngredientScope">
): string | null {
  return ingredientLinkKey(ing.masterIngredientId, ing.masterIngredientScope);
}

/** All stable link keys for pantry/suggestion matching (primary + substitutes, deduped). */
export function ingredientLineLinkKeys(
  ing: Pick<Ingredient, "masterIngredientId" | "masterIngredientScope" | "substituteLinks">
): string[] {
  const keys = new Set<string>();
  const primary = ingredientLinkKey(ing.masterIngredientId, ing.masterIngredientScope);
  if (primary) keys.add(primary);
  for (const sub of ing.substituteLinks ?? []) {
    const k = ingredientLinkKey(sub.masterIngredientId, sub.masterIngredientScope);
    if (k) keys.add(k);
  }
  return [...keys];
}
