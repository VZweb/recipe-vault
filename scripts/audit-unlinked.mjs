#!/usr/bin/env node
/**
 * audit-unlinked.mjs
 *
 * Scans Firestore (user-scoped pantry + recipes) for lines missing
 * masterIngredientId. Uses collection groups `pantry` and `recipes`.
 *
 * Usage:
 *   node scripts/audit-unlinked.mjs
 *
 * Requires a service account key at scripts/service-account.json
 */

import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const serviceAccountPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "service-account.json"
);

const app = initializeApp({
  credential: cert(serviceAccountPath),
});

const db = getFirestore(app);

async function audit() {
  console.log("=== Unlinked Items Audit ===\n");

  const pantrySnap = await db.collectionGroup("pantry").get();
  const unlinkedPantry = [];
  for (const doc of pantrySnap.docs) {
    const data = doc.data();
    if (!data.masterIngredientId) {
      unlinkedPantry.push({
        path: doc.ref.path,
        id: doc.id,
        name: data.name,
        category: data.category,
      });
    }
  }

  console.log(`Pantry: ${pantrySnap.size} total, ${unlinkedPantry.length} unlinked`);
  if (unlinkedPantry.length > 0) {
    console.log("  Unlinked pantry items:");
    for (const item of unlinkedPantry) {
      console.log(`    - ${item.path} "${item.name}" (${item.category})`);
    }
  }
  console.log();

  const recipesSnap = await db.collectionGroup("recipes").get();
  let totalIngredients = 0;
  let unlinkedIngredients = 0;
  const recipesWithUnlinked = [];

  for (const doc of recipesSnap.docs) {
    const data = doc.data();
    const ingredients = data.ingredients ?? [];
    const unlinked = [];

    for (const ing of ingredients) {
      if (ing.isSection) continue;
      totalIngredients++;
      if (!ing.masterIngredientId) {
        unlinkedIngredients++;
        unlinked.push(ing.name);
      }
    }

    if (unlinked.length > 0) {
      recipesWithUnlinked.push({
        path: doc.ref.path,
        id: doc.id,
        title: data.title,
        total: ingredients.filter((i) => !i.isSection).length,
        unlinked,
      });
    }
  }

  console.log(
    `Recipes: ${recipesSnap.size} recipes, ${totalIngredients} ingredients total, ${unlinkedIngredients} unlinked`
  );
  if (recipesWithUnlinked.length > 0) {
    console.log(`  ${recipesWithUnlinked.length} recipe(s) have unlinked ingredients:`);
    for (const r of recipesWithUnlinked) {
      console.log(
        `    - ${r.path} "${r.title}" — ${r.unlinked.length}/${r.total} unlinked:`
      );
      for (const name of r.unlinked) {
        console.log(`        • ${name}`);
      }
    }
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

audit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
