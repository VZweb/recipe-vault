#!/usr/bin/env node
/**
 * delete-recipes.mjs
 *
 * Deletes all documents from the Firestore `recipes` collection.
 * Optionally also deletes orphaned tags created during a previous import.
 *
 * Usage:
 *   node delete-recipes.mjs [--include-tags] [--dry-run]
 *
 * Requires a service account key at scripts/service-account.json
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const includeTags = args.includes("--include-tags");

if (args.includes("--help")) {
  console.log(`
Usage:
  node delete-recipes.mjs [--include-tags] [--dry-run]

Options:
  --include-tags  Also delete all documents in the 'tags' collection
  --dry-run       Show what would be deleted without actually deleting
  --help          Show this help

Requires:
  scripts/service-account.json  (Firebase Admin service account key)
`);
  process.exit(0);
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
      "  1. Go to Firebase Console → Project Settings → Service Accounts\n" +
      "  2. Click 'Generate new private key'\n" +
      "  3. Save the downloaded file as scripts/service-account.json\n"
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
db.settings({ preferRest: true });

// ---------------------------------------------------------------------------
// Batch delete helper
// ---------------------------------------------------------------------------

async function deleteCollection(collectionName) {
  const colRef = db.collection(collectionName);
  const snap = await colRef.get();

  if (snap.empty) {
    console.log(`  ${collectionName}: collection is empty, nothing to delete.`);
    return 0;
  }

  console.log(`  ${collectionName}: found ${snap.size} document(s).`);

  if (dryRun) {
    console.log(`  [dry-run] Would delete ${snap.size} document(s) from '${collectionName}'.`);
    return snap.size;
  }

  const BATCH_SIZE = 450;
  let deleted = 0;

  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const chunk = snap.docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += chunk.length;
    console.log(`  ${collectionName}: deleted ${deleted}/${snap.size}`);
  }

  return deleted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log(
  dryRun
    ? "\n** DRY RUN — nothing will be deleted **\n"
    : "\nDeleting documents from Firestore...\n"
);

let totalDeleted = 0;

totalDeleted += await deleteCollection("recipes");

if (includeTags) {
  totalDeleted += await deleteCollection("tags");
}

console.log(
  dryRun
    ? `\n[dry-run] Would delete ${totalDeleted} document(s) total.\n`
    : `\nDone. Deleted ${totalDeleted} document(s) total.\n`
);

process.exit(0);
