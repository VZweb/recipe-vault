export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string;
  sortOrder: number;
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
  imageUrls: string[];
  tags: string[];
  ingredients: Ingredient[];
  steps: Step[];
  createdAt: Date;
  updatedAt: Date;
}

export type RecipeFormData = Omit<Recipe, "id" | "createdAt" | "updatedAt">;
