import type { MasterIngredientScope } from "./ingredientRef";

/** Another catalog/custom master that satisfies the same recipe line for pantry matching. */
export interface IngredientSubstituteLink {
  masterIngredientId: string;
  masterIngredientScope: MasterIngredientScope;
}

export interface Ingredient {
  name: string;
  nameSecondary: string;
  quantity: number | null;
  unit: string;
  sortOrder: number;
  masterIngredientId: string | null;
  /** `catalog` = ingredientCatalog; `custom` = users/{uid}/customIngredients; null = legacy / unlinked */
  masterIngredientScope: MasterIngredientScope;
  /** Optional extra master links; pantry/suggestions match if any primary or substitute key is in pantry. */
  substituteLinks: IngredientSubstituteLink[];
  note: string;
  isSection: boolean;
}

export interface Step {
  instruction: string;
  imageUrl: string | null;
  sortOrder: number;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: number | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  sourceUrl: string;
  videoUrl: string;
  imageUrls: string[];
  categoryId: string | null;
  tags: string[];
  ingredients: Ingredient[];
  steps: Step[];
  notes: string;
  cookedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type RecipeFormData = Omit<Recipe, "id" | "createdAt" | "updatedAt" | "cookedCount">;
