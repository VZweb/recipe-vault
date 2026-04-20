#!/usr/bin/env node
/**
 * import-recipes.mjs
 *
 * Reads the JSON file produced by parse-keep.mjs (or any file matching
 * the recipe-vault schema) and writes each recipe into Firestore.
 *
 * Usage:
 *   node import-recipes.mjs <parsed-recipes.json> --owner-uid=FIREBASE_AUTH_UID [--dry-run]
 *
 * Requires a service account key at scripts/service-account.json
 * (or set GOOGLE_APPLICATION_CREDENTIALS env var to the key path).
 *
 * To generate the key:
 *   Firebase Console → Project Settings → Service Accounts → Generate New Private Key
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const jsonPath = args.find((a) => !a.startsWith("--"));
const ownerArg = args.find((a) => a.startsWith("--owner-uid="));
const ownerUid = ownerArg?.slice("--owner-uid=".length)?.trim() ?? "";

if (!jsonPath || args.includes("--help")) {
  console.log(`
Usage:
  node import-recipes.mjs <parsed-recipes.json> --owner-uid=FIREBASE_AUTH_UID [--dry-run]

Options:
  --owner-uid  Firebase Auth uid of the account that should own imported recipes and new tags
  --dry-run    Validate & log without writing to Firestore
  --help       Show this help

Requires:
  scripts/service-account.json  (Firebase Admin service account key)
  Generate at: Firebase Console → Project Settings → Service Accounts
`);
  process.exit(0);
}

if (!dryRun && !ownerUid) {
  console.error(
    "Error: --owner-uid=FIREBASE_AUTH_UID is required when writing (omit only with --dry-run)."
  );
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error(`Error: file not found: ${jsonPath}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Firebase Admin init
// ---------------------------------------------------------------------------

const scriptDir = import.meta.dirname;
const saPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(scriptDir, "service-account.json");

if (!fs.existsSync(saPath)) {
  console.error(
    `Service account key not found at: ${saPath}\n\n` +
      "To generate one:\n" +
      "  1. Go to https://console.firebase.google.com/project/recipe-vault-4fc8c/settings/serviceaccounts/adminsdk\n" +
      "  2. Click 'Generate new private key'\n" +
      "  3. Save the downloaded file as scripts/service-account.json\n"
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf-8"));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
db.settings({ preferRest: true });
const recipesCol = db.collection("recipes");
const tagsCol = db.collection("tags");

// ---------------------------------------------------------------------------
// Tag resolution: match Keep labels to existing tags or create new ones
// ---------------------------------------------------------------------------

async function loadExistingTags(uid) {
  const snap = await tagsCol.where("ownerId", "==", uid).orderBy("name").get();
  const tags = new Map();
  snap.docs.forEach((d) => {
    tags.set(d.data().name.toLowerCase(), { id: d.id, name: d.data().name });
  });
  return tags;
}

const TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#8b5cf6", "#ec4899", "#78716c", "#6366f1",
];
let colorIdx = 0;

async function resolveTagIds(labelNames, existingTags, uid) {
  const ids = [];
  for (const name of labelNames) {
    const key = name.toLowerCase();
    if (existingTags.has(key)) {
      ids.push(existingTags.get(key).id);
    } else {
      const color = TAG_COLORS[colorIdx % TAG_COLORS.length];
      colorIdx++;
      if (!dryRun) {
        const docRef = await tagsCol.add({
          name,
          color,
          category: "Other",
          ownerId: uid,
        });
        existingTags.set(key, { id: docRef.id, name });
        ids.push(docRef.id);
        console.log(`  Created tag: "${name}" (${docRef.id})`);
      } else {
        console.log(`  [dry-run] Would create tag: "${name}"`);
        ids.push(`dry-run-tag-${key}`);
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const recipes = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

if (!Array.isArray(recipes)) {
  console.error("Error: JSON root must be an array of recipe objects.");
  process.exit(1);
}

console.log(`\nLoaded ${recipes.length} recipe(s) from ${jsonPath}`);
if (dryRun) console.log("** DRY RUN — nothing will be written to Firestore **\n");

const existingTags = ownerUid
  ? await loadExistingTags(ownerUid)
  : new Map();
console.log(
  `Found ${existingTags.size} existing tag(s) for this owner in Firestore.\n`
);

let imported = 0;
let errors = 0;

for (let i = 0; i < recipes.length; i++) {
  const r = recipes[i];
  const label = `[${i + 1}/${recipes.length}]`;

  if (!r.title) {
    console.warn(`${label} Skipping entry with no title.`);
    errors++;
    continue;
  }

  try {
    const tagIds =
      r.tags && r.tags.length > 0
        ? await resolveTagIds(r.tags, existingTags, ownerUid || "dry-run")
        : [];

    const now = Timestamp.now();
    const doc = {
      title: r.title || "",
      description: r.description || "",
      servings: r.servings ?? null,
      prepTimeMin: r.prepTimeMin ?? null,
      cookTimeMin: r.cookTimeMin ?? null,
      sourceUrl: r.sourceUrl || "",
      videoUrl: r.videoUrl || "",
      imageUrls: r.imageUrls || [],
      tags: tagIds,
      ingredients: (r.ingredients || []).map((ing, idx) => ({
        name: ing.name || "",
        nameSecondary: ing.nameSecondary || "",
        quantity: ing.quantity ?? null,
        unit: ing.unit || "",
        sortOrder: ing.sortOrder ?? idx,
        masterIngredientId: ing.masterIngredientId ?? null,
        note: ing.note || "",
        isSection: ing.isSection ?? false,
      })),
      steps: (r.steps || []).map((s, idx) => ({
        instruction: typeof s === "string" ? s : s.instruction || "",
        imageUrl: s.imageUrl ?? null,
        sortOrder: s.sortOrder ?? idx,
      })),
      cookedCount: 0,
      createdAt: now,
      updatedAt: now,
      ownerId: ownerUid,
    };

    const linked = doc.ingredients.filter((i) => i.masterIngredientId).length;
    const ingStats = `${doc.ingredients.length} ingredients (${linked} linked)`;

    if (dryRun) {
      console.log(
        `${label} Would import: "${r.title}" ` +
          `(${ingStats}, ${doc.steps.length} steps)`
      );
    } else {
      const ref = await recipesCol.add(doc);
      console.log(
        `${label} Imported: "${r.title}" → ${ref.id} ` +
          `(${ingStats}, ${doc.steps.length} steps)`
      );
    }
    imported++;
  } catch (err) {
    console.error(`${label} Error importing "${r.title}": ${err.message}`);
    errors++;
  }
}

console.log(`
Import complete:
  Imported : ${imported}
  Errors   : ${errors}
  Total    : ${recipes.length}
`);

process.exit(errors > 0 ? 1 : 0);
