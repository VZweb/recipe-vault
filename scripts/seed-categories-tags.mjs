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
  path.resolve(decodeURIComponent(new URL(".", import.meta.url).pathname), "service-account.json");

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
  // Time
  { name: "Quick (≤20 min)", color: "#eab308", category: "Time" },
  { name: "30-Min Meal",     color: "#f97316", category: "Time" },
  { name: "1 Hour",          color: "#ef4444", category: "Time" },
  { name: "Meal Prep",       color: "#3b82f6", category: "Time" },

  // Method
  { name: "One-Pot",          color: "#06b6d4", category: "Method" },
  { name: "Pan-Fried",        color: "#f97316", category: "Method" },
  { name: "Baked",            color: "#ef4444", category: "Method" },
  { name: "Grilled",          color: "#ef4444", category: "Method" },
  { name: "Air Fryer",        color: "#8b5cf6", category: "Method" },
  { name: "Stir-Fry",         color: "#eab308", category: "Method" },
  { name: "No-Cook",          color: "#22c55e", category: "Method" },
  { name: "Pressure Cooker",  color: "#0d9488", category: "Method" },
  { name: "BBQ",              color: "#ef4444", category: "Method" },

  // Diet / Nutrition
  { name: "High-Protein",  color: "#3b82f6", category: "Diet / Nutrition" },
  { name: "Vegetarian",    color: "#22c55e", category: "Diet / Nutrition" },
  { name: "Vegan",         color: "#22c55e", category: "Diet / Nutrition" },
  { name: "Healthy",       color: "#0d9488", category: "Diet / Nutrition" },
  { name: "Comfort Food",  color: "#ec4899", category: "Diet / Nutrition" },

  // Cuisine
  { name: "Italian",        color: "#22c55e", category: "Cuisine" },
  { name: "Asian",           color: "#f97316", category: "Cuisine" },
  { name: "Mexican",         color: "#ef4444", category: "Cuisine" },
  { name: "Mediterranean",   color: "#06b6d4", category: "Cuisine" },
  { name: "Greek",           color: "#3b82f6", category: "Cuisine" },
  { name: "Indian",          color: "#eab308", category: "Cuisine" },
  { name: "Middle Eastern",  color: "#8b5cf6", category: "Cuisine" },
  { name: "American",        color: "#3b82f6", category: "Cuisine" },

  // Occasion
  { name: "Breakfast",     color: "#f97316", category: "Occasion" },
  { name: "Lunch",         color: "#eab308", category: "Occasion" },
  { name: "Dinner",        color: "#ef4444", category: "Occasion" },
  { name: "Snack",         color: "#22c55e", category: "Occasion" },
  { name: "Brunch",        color: "#ec4899", category: "Occasion" },
  { name: "Party",         color: "#8b5cf6", category: "Occasion" },
  { name: "Kid-Friendly",  color: "#06b6d4", category: "Occasion" },

  // Flavor
  { name: "Spicy",   color: "#ef4444", category: "Flavor" },
  { name: "Sweet",   color: "#ec4899", category: "Flavor" },
  { name: "Savory",  color: "#f97316", category: "Flavor" },

  // Other
  { name: "Favorites",       color: "#eab308", category: "Other" },
  { name: "To Try",          color: "#3b82f6", category: "Other" },
  { name: "Guest Favorite",  color: "#8b5cf6", category: "Other" },
  { name: "Kid Approved",    color: "#06b6d4", category: "Other" },
  { name: "Kids",            color: "#22c55e", category: "Other" },
  { name: "Quick N' Easy",   color: "#eab308", category: "Other" },
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

/**
 * Back-fill the `category` field on existing tag documents that are missing it.
 * Matches by name against DEFAULT_TAGS; unmatched docs get "Other".
 */
async function backfillTagCategories() {
  const col = db.collection("tags");
  const snap = await col.get();
  const nameToCategory = new Map(DEFAULT_TAGS.map((t) => [t.name, t.category]));
  const toUpdate = [];

  for (const d of snap.docs) {
    const data = d.data();
    if (data.category) continue;
    const category = nameToCategory.get(data.name) ?? "Other";
    toUpdate.push({ ref: d.ref, category });
  }

  if (toUpdate.length === 0) {
    console.log("  ✓ tags: all documents already have a category");
    return;
  }

  console.log(`  → tags: back-filling category on ${toUpdate.length} documents`);

  if (dryRun) {
    for (const { ref, category } of toUpdate) {
      console.log(`    [DRY] ${ref.id} → ${category}`);
    }
    return;
  }

  const batch = db.batch();
  for (const { ref, category } of toUpdate) {
    batch.update(ref, { category });
  }
  await batch.commit();
  console.log(`  ✓ tags: back-filled ${toUpdate.length} documents`);
}

async function main() {
  console.log(`\nSeeding Firestore${dryRun ? " (DRY RUN)" : ""}...\n`);

  await seedCollection("categories", DEFAULT_CATEGORIES, ["name", "icon", "description"]);
  await seedCollection("tags", DEFAULT_TAGS, ["name", "color", "category"]);
  await backfillTagCategories();

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
