import type { MasterIngredientScope } from "./ingredientRef";

export interface Ingredient {
  name: string;
  nameSecondary: string;
  quantity: number | null;
  unit: string;
  sortOrder: number;
  masterIngredientId: string | null;
  /** `catalog` = ingredientCatalog; `custom` = users/{uid}/customIngredients; null = legacy / unlinked */
  masterIngredientScope: MasterIngredientScope;
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
