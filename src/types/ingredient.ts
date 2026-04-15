export interface MasterIngredient {
  id: string;
  name: string;
  nameGr: string;
  aliases: string[];
  category: IngredientCategory;
}

export type IngredientCategory =
  | "Vegetables"
  | "Fruits"
  | "Meat & Poultry"
  | "Fish & Seafood"
  | "Dairy & Eggs"
  | "Grains & Pasta"
  | "Canned & Jarred"
  | "Spices & Herbs"
  | "Oils & Vinegars"
  | "Baking"
  | "Condiments & Sauces"
  | "Nuts & Seeds"
  | "Frozen"
  | "Other";

export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  "Vegetables",
  "Fruits",
  "Meat & Poultry",
  "Fish & Seafood",
  "Dairy & Eggs",
  "Grains & Pasta",
  "Canned & Jarred",
  "Spices & Herbs",
  "Oils & Vinegars",
  "Baking",
  "Condiments & Sauces",
  "Nuts & Seeds",
  "Frozen",
  "Other",
];
