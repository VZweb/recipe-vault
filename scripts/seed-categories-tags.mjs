#!/usr/bin/env node
/**
 * seed-categories-tags.mjs
 *
 * Seeds the Firestore `categories` and `tags` collections with a curated
 * default set. Existing documents are left untouched — only new entries
 * (matched by name) are created.
 *
 * Usage:
 *   node seed-categories-tags.mjs [--dry-run]
 *
 * Requires a service account key at scripts/service-account.json
 * (or set GOOGLE_APPLICATION_CREDENTIALS env var to the key path).
 */

import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const saPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(new URL(".", import.meta.url).pathname, "service-account.json");

initializeApp({ credential: cert(saPath) });
const db = getFirestore();

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES = [
  { name: "Pasta & Noodles", icon: "wheat", description: "Spaghetti, lasagna, pad thai, ramen, and more" },
  { name: "Salad", icon: "salad", description: "Fresh greens, grain bowls, and cold salads" },
  { name: "Soup & Stew", icon: "soup", description: "Hearty soups, chilis, and slow-cooked stews" },
  { name: "Meat & Poultry", icon: "beef", description: "Chicken, beef, pork, and lamb dishes" },
  { name: "Seafood & Fish", icon: "fish", description: "Grilled fish, shrimp, and seafood plates" },
  { name: "Rice & Grains", icon: "wheat", description: "Risotto, fried rice, pilaf, and grain dishes" },
  { name: "Pizza & Flatbread", icon: "pizza", description: "Homemade pizza, focaccia, and flatbreads" },
  { name: "Sandwich & Wrap", icon: "sandwich", description: "Burritos, gyros, subs, and wraps" },
  { name: "Pie & Tart", icon: "cooking-pot", description: "Quiche, pot pie, galette, and savory tarts" },
  { name: "Breakfast & Brunch", icon: "egg-fried", description: "Pancakes, eggs, smoothie bowls, and brunch plates" },
  { name: "Appetizer & Snack", icon: "cherry", description: "Dips, bruschetta, spring rolls, and finger food" },
  { name: "Side Dish", icon: "leaf", description: "Roasted vegetables, coleslaw, and accompaniments" },
  { name: "Dessert & Baking", icon: "cake", description: "Cookies, cakes, pies, and sweet treats" },
  { name: "Beverage", icon: "cup-soda", description: "Smoothies, cocktails, and homemade drinks" },
  { name: "Sauce & Condiment", icon: "bean", description: "Pesto, vinaigrettes, salsa, and dips" },
  { name: "Other", icon: "utensils", description: "Anything that doesn't fit elsewhere" },
];

const DEFAULT_TAGS = [
  // Cooking Method / Equipment
  { name: "Air Fryer", color: "#ef4444" },
  { name: "Pressure Cooker", color: "#f97316" },
  { name: "Slow Cooker", color: "#eab308" },
  { name: "Grill", color: "#ef4444" },
  { name: "Oven-Baked", color: "#f97316" },
  { name: "Stovetop", color: "#eab308" },
  { name: "No-Cook", color: "#22c55e" },
  { name: "One-Pot", color: "#06b6d4" },
  { name: "Sheet Pan", color: "#3b82f6" },
  // Dietary & Health
  { name: "Vegetarian", color: "#22c55e" },
  { name: "Vegan", color: "#22c55e" },
  { name: "Gluten-Free", color: "#0d9488" },
  { name: "Dairy-Free", color: "#0d9488" },
  { name: "Keto / Low-Carb", color: "#8b5cf6" },
  { name: "Fasting", color: "#78716c" },
  { name: "High-Protein", color: "#3b82f6" },
  { name: "Low-Calorie", color: "#06b6d4" },
  // Effort & Time
  { name: "Quick (< 30 min)", color: "#eab308" },
  { name: "5 Ingredients or Less", color: "#22c55e" },
  { name: "Meal Prep", color: "#3b82f6" },
  { name: "Freezer-Friendly", color: "#06b6d4" },
  { name: "Beginner-Friendly", color: "#ec4899" },
  // Occasion
  { name: "Weeknight Dinner", color: "#f97316" },
  { name: "Holiday", color: "#ef4444" },
  { name: "Comfort Food", color: "#ec4899" },
  { name: "Lunchbox", color: "#eab308" },
  // Cuisine
  { name: "Greek", color: "#3b82f6" },
  { name: "Italian", color: "#22c55e" },
  { name: "Mexican", color: "#ef4444" },
  { name: "Asian", color: "#f97316" },
  { name: "Middle Eastern", color: "#eab308" },
  { name: "Mediterranean", color: "#06b6d4" },
  { name: "French", color: "#8b5cf6" },
  { name: "American", color: "#3b82f6" },
];

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------

async function seedCollection(colName, items, fields) {
  const col = db.collection(colName);
  const snap = await col.get();
  const existingNames = new Set(snap.docs.map((d) => d.data().name));

  const toCreate = items.filter((item) => !existingNames.has(item.name));

  if (toCreate.length === 0) {
    console.log(`  ✓ ${colName}: all ${items.length} entries already exist`);
    return;
  }

  console.log(
    `  → ${colName}: creating ${toCreate.length} new entries (${existingNames.size} already exist)`
  );

  if (dryRun) {
    for (const item of toCreate) {
      console.log(`    [DRY] would create: ${item.name}`);
    }
    return;
  }

  const batch = db.batch();
  for (const item of toCreate) {
    const data = {};
    for (const f of fields) data[f] = item[f];
    batch.create(col.doc(), data);
  }
  await batch.commit();
  console.log(`  ✓ ${colName}: created ${toCreate.length} entries`);
}

async function main() {
  console.log(`\nSeeding Firestore${dryRun ? " (DRY RUN)" : ""}...\n`);

  await seedCollection("categories", DEFAULT_CATEGORIES, ["name", "icon", "description"]);
  await seedCollection("tags", DEFAULT_TAGS, ["name", "color"]);

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
