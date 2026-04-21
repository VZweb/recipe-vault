import type { MasterIngredientScope } from "./ingredientRef";

export interface PantryItem {
  id: string;
  name: string;
  nameSecondary: string | null;
  normalizedName: string;
  category: PantryCategory;
  quantity: number | null;
  unit: string | null;
  isStaple: boolean;
  imageUrl: string | null;
  masterIngredientId: string;
  /** `catalog` / `custom` / null (legacy); empty masterIngredientId implies null scope */
  masterIngredientScope: MasterIngredientScope;
  note: string;
  addedAt: Date;
}

export const PANTRY_UNITS = [
  "pcs",
  "kg",
  "g",
  "L",
  "mL",
  "cups",
  "tbsp",
  "tsp",
  "bunch",
  "can",
  "bottle",
  "bag",
  "box",
  "pack",
] as const;

export type PantryUnit = (typeof PANTRY_UNITS)[number];

export type PantryCategory =
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

export const PANTRY_CATEGORIES: PantryCategory[] = [
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
