import type { PantryCategory } from "@/types/pantry";

interface PantrySeed {
  name: string;
  category: PantryCategory;
  isStaple: boolean;
}

export const PANTRY_SEEDS: PantrySeed[] = [
  // Oils & Vinegars
  { name: "Olive oil", category: "Oils & Vinegars", isStaple: true },
  { name: "Vegetable oil", category: "Oils & Vinegars", isStaple: true },
  { name: "Balsamic vinegar", category: "Oils & Vinegars", isStaple: true },
  { name: "Red wine vinegar", category: "Oils & Vinegars", isStaple: true },

  // Spices & Herbs
  { name: "Salt", category: "Spices & Herbs", isStaple: true },
  { name: "Black pepper", category: "Spices & Herbs", isStaple: true },
  { name: "Garlic powder", category: "Spices & Herbs", isStaple: true },
  { name: "Onion powder", category: "Spices & Herbs", isStaple: true },
  { name: "Paprika", category: "Spices & Herbs", isStaple: true },
  { name: "Cumin", category: "Spices & Herbs", isStaple: true },
  { name: "Oregano", category: "Spices & Herbs", isStaple: true },
  { name: "Basil (dried)", category: "Spices & Herbs", isStaple: true },
  { name: "Thyme (dried)", category: "Spices & Herbs", isStaple: true },
  { name: "Cinnamon", category: "Spices & Herbs", isStaple: true },
  { name: "Chili flakes", category: "Spices & Herbs", isStaple: true },

  // Baking
  { name: "All-purpose flour", category: "Baking", isStaple: true },
  { name: "Sugar", category: "Baking", isStaple: true },
  { name: "Brown sugar", category: "Baking", isStaple: true },
  { name: "Baking powder", category: "Baking", isStaple: true },
  { name: "Baking soda", category: "Baking", isStaple: true },
  { name: "Vanilla extract", category: "Baking", isStaple: true },

  // Condiments & Sauces
  { name: "Soy sauce", category: "Condiments & Sauces", isStaple: true },
  { name: "Mustard", category: "Condiments & Sauces", isStaple: true },
  { name: "Honey", category: "Condiments & Sauces", isStaple: true },
  { name: "Ketchup", category: "Condiments & Sauces", isStaple: true },
  { name: "Hot sauce", category: "Condiments & Sauces", isStaple: true },

  // Vegetables (common, not staple by default)
  { name: "Garlic", category: "Vegetables", isStaple: true },
  { name: "Onion", category: "Vegetables", isStaple: true },
  { name: "Potatoes", category: "Vegetables", isStaple: false },
  { name: "Tomatoes", category: "Vegetables", isStaple: false },
  { name: "Lemons", category: "Fruits", isStaple: true },

  // Grains & Pasta
  { name: "Rice", category: "Grains & Pasta", isStaple: true },
  { name: "Pasta (spaghetti)", category: "Grains & Pasta", isStaple: true },
  { name: "Bread", category: "Grains & Pasta", isStaple: false },

  // Dairy & Eggs
  { name: "Butter", category: "Dairy & Eggs", isStaple: true },
  { name: "Eggs", category: "Dairy & Eggs", isStaple: true },
  { name: "Milk", category: "Dairy & Eggs", isStaple: false },
  { name: "Parmesan cheese", category: "Dairy & Eggs", isStaple: false },

  // Canned & Jarred
  { name: "Canned tomatoes", category: "Canned & Jarred", isStaple: true },
  { name: "Tomato paste", category: "Canned & Jarred", isStaple: true },
  { name: "Chicken broth", category: "Canned & Jarred", isStaple: false },
];
