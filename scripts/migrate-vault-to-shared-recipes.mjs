#!/usr/bin/env node
/**
 * Copy recipe documents from users/{uid}/recipes into the top-level sharedRecipes
 * collection, denormalizing tag and category document ids to tagNames and categoryName.
 *
 * Usage:
 *   node scripts/migrate-vault-to-shared-recipes.mjs --source-uid=FIREBASE_UID
 *   node scripts/migrate-vault-to-shared-recipes.mjs --source-uid=UID --dry-run
 *   node scripts/migrate-vault-to-shared-recipes.mjs --source-uid=UID --overwrite
 *
 * Requires: scripts/service-account.json or GOOGLE_APPLICATION_CREDENTIALS.
 *
 * After migration, images still point at recipes/{uid}/... Storage paths unless you
 * re-upload to recipes/library/{recipeId}/files/... from the app as library admin.
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const overwrite = args.includes("--overwrite");

function argVal(prefix) {
  const a = args.find((x) => x.startsWith(prefix));
  return a?.slice(prefix.length)?.trim() ?? "";
}

const sourceUid =
  argVal("--source-uid=") ||
  (args.includes("--source-uid") && args[args.indexOf("--source-uid") + 1]) ||
  "";

if (!sourceUid || args.includes("--help")) {
  console.log(`
Migrate vault recipes to sharedRecipes (Admin SDK).

  --source-uid=UID   Firebase Auth uid whose users/UID/recipes to read
  --dry-run          Log only, no writes
  --overwrite        Write even if sharedRecipes doc id already exists

Requires scripts/service-account.json or GOOGLE_APPLICATION_CREDENTIALS.
`);
  process.exit(sourceUid ? 0 : 1);
}

const scriptDir = import.meta.dirname;
const saPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(scriptDir, "service-account.json");

if (!fs.existsSync(saPath)) {
  console.error(`Service account key not found: ${saPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const recipesCol = db.collection("users").doc(sourceUid).collection("recipes");
const tagsCol = db.collection("users").doc(sourceUid).collection("tags");
const categoriesCol = db.collection("users").doc(sourceUid).collection("categories");
const sharedCol = db.collection("sharedRecipes");

const [tagSnap, catSnap, recipeSnap] = await Promise.all([
  tagsCol.get(),
  categoriesCol.get(),
  recipesCol.orderBy("createdAt", "desc").get(),
]);

const tagById = new Map(tagSnap.docs.map((d) => [d.id, d.data().name ?? ""]));
const catById = new Map(
  catSnap.docs.map((d) => [d.id, d.data().name ?? ""])
);

let written = 0;
let skipped = 0;

for (const d of recipeSnap.docs) {
  const data = d.data();
  const tagIds = Array.isArray(data.tags) ? data.tags : [];
  const tagNames = tagIds
    .map((id) => tagById.get(id))
    .filter((n) => typeof n === "string" && n.trim());
  const categoryId = data.categoryId;
  const categoryName =
    categoryId && typeof categoryId === "string"
      ? catById.get(categoryId) ?? null
      : null;

  const destRef = sharedCol.doc(d.id);
  const exists = (await destRef.get()).exists;

  const payload = {
    title: data.title ?? "",
    description: data.description ?? "",
    servings: data.servings ?? null,
    prepTimeMin: data.prepTimeMin ?? null,
    cookTimeMin: data.cookTimeMin ?? null,
    sourceUrl: data.sourceUrl ?? "",
    videoUrl: data.videoUrl ?? "",
    imageUrls: data.imageUrls ?? [],
    ingredients: data.ingredients ?? [],
    steps: data.steps ?? [],
    notes: data.notes ?? "",
    tagNames,
    categoryName: categoryName && String(categoryName).trim() ? String(categoryName).trim() : null,
    createdAt: data.createdAt ?? Timestamp.now(),
    updatedAt: data.updatedAt ?? Timestamp.now(),
  };

  if (exists && !overwrite) {
    console.log(`[skip] ${d.id} (exists)`);
    skipped += 1;
    continue;
  }

  if (dryRun) {
    console.log(`[dry-run] would write sharedRecipes/${d.id} ${payload.title}`);
    written += 1;
    continue;
  }

  await destRef.set(payload, { merge: false });
  console.log(`[ok] sharedRecipes/${d.id} ${payload.title}`);
  written += 1;
}

console.log(
  dryRun
    ? `Done (dry-run). Would write: ${written}, skipped: ${skipped}.`
    : `Done. Written: ${written}, skipped: ${skipped}.`
);

process.exit(0);
