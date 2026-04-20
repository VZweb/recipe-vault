import { TAG_COLORS } from "@/types/tag";

/** Starter tags copied into each new account (owned by the user; fully editable). */
export const DEFAULT_TAGS: ReadonlyArray<{
  name: string;
  color: string;
  category: string;
}> = [
  { name: "Under 30 min", color: TAG_COLORS[3]!, category: "Time" },
  { name: "Make-ahead", color: TAG_COLORS[8]!, category: "Time" },
  { name: "One pot", color: TAG_COLORS[5]!, category: "Method" },
  { name: "Oven", color: TAG_COLORS[1]!, category: "Method" },
  { name: "Grill", color: TAG_COLORS[4]!, category: "Method" },
  { name: "Vegetarian", color: TAG_COLORS[3]!, category: "Diet / Nutrition" },
  { name: "Vegan", color: TAG_COLORS[6]!, category: "Diet / Nutrition" },
  { name: "High protein", color: TAG_COLORS[2]!, category: "Diet / Nutrition" },
  { name: "Italian", color: TAG_COLORS[5]!, category: "Cuisine" },
  { name: "Greek", color: TAG_COLORS[9]!, category: "Cuisine" },
  { name: "Mexican", color: TAG_COLORS[1]!, category: "Cuisine" },
  { name: "Asian", color: TAG_COLORS[4]!, category: "Cuisine" },
  { name: "Weeknight", color: TAG_COLORS[5]!, category: "Occasion" },
  { name: "Weekend", color: TAG_COLORS[6]!, category: "Occasion" },
  { name: "Comfort food", color: TAG_COLORS[0]!, category: "Occasion" },
  { name: "Spicy", color: TAG_COLORS[0]!, category: "Flavor" },
  { name: "Kid-friendly", color: TAG_COLORS[2]!, category: "Other" },
];

/** Starter recipe categories copied into each new account (owned by the user; fully editable). */
export const DEFAULT_CATEGORIES: ReadonlyArray<{
  name: string;
  description: string;
  icon: string;
}> = [
  { name: "Main dishes", description: "Entrées and centerpiece plates", icon: "beef" },
  { name: "Soups & stews", description: "Bowls, broths, and slow-cooked pots", icon: "soup" },
  { name: "Salads & sides", description: "Light plates and accompaniments", icon: "salad" },
  { name: "Baking & desserts", description: "Cakes, cookies, and sweet bakes", icon: "cake" },
  { name: "Breakfast & brunch", description: "Morning meals and brunch favorites", icon: "egg-fried" },
  { name: "Snacks & small bites", description: "Appetizers, snacks, and finger food", icon: "cookie" },
  { name: "Drinks", description: "Beverages and smoothies", icon: "cup-soda" },
  { name: "Basics & staples", description: "Sauces, stocks, and building blocks", icon: "cooking-pot" },
];
