export interface Ingredient {
  name: string;
  nameSecondary: string;
  quantity: number | null;
  unit: string;
  sortOrder: number;
  masterIngredientId: string | null;
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
  cookedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type RecipeFormData = Omit<Recipe, "id" | "createdAt" | "updatedAt" | "cookedCount">;
