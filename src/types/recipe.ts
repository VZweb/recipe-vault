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

export type RecipeScope = "vault" | "library";

export interface Recipe {
  id: string;
  /** Vault recipes use tag/category doc ids; library recipes use denormalized labels. */
  recipeScope: RecipeScope;
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
  /** When `recipeScope === "library"`: display/filter labels (shared across accounts). */
  tagNames?: string[];
  /** When `recipeScope === "library"`: category display name. */
  categoryName?: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  notes: string;
  cookedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type RecipeFormData = Omit<
  Recipe,
  "id" | "createdAt" | "updatedAt" | "cookedCount" | "recipeScope" | "tagNames" | "categoryName"
>;
