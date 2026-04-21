#!/usr/bin/env node
/**
 * delete-recipes.mjs
 *
 * Deletes all documents in `users/{ownerUid}/recipes`.
 * Optionally also deletes `users/{ownerUid}/tags`.
 *
 * Usage:
 *   node scripts/delete-recipes.mjs --owner-uid=FIREBASE_UID [--include-tags] [--dry-run]
 *
 * Requires a service account key at scripts/service-account.json
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const includeTags = args.includes("--include-tags");
const ownerArg = args.find((a) => a.startsWith("--owner-uid="));
const ownerUid = ownerArg?.slice("--owner-uid=".length)?.trim() ?? "";

if (args.includes("--help")) {
  console.log(`
Usage:
  node scripts/delete-recipes.mjs --owner-uid=FIREBASE_UID [--include-tags] [--dry-run]

Options:
  --owner-uid     Required. Deletes recipes under users/{uid}/recipes
  --include-tags  Also delete users/{uid}/tags
  --dry-run       Show what would be deleted without actually deleting
  --help          Show this help

Requires:
  scripts/service-account.json  (Firebase Admin service account key)
`);
  process.exit(0);
}

if (!ownerUid) {
  console.error("Required: --owner-uid=FIREBASE_AUTH_UID");
  process.exit(1);
}

const scriptDir = import.meta.dirname;
const saPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(scriptDir, "service-account.json");

if (!fs.existsSync(saPath)) {
  console.error(`Service account key not found at: ${saPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
db.settings({ preferRest: true });

async function deleteSubcollection(uid, sub) {
  const colRef = db.collection("users").doc(uid).collection(sub);
  const snap = await colRef.get();

  if (snap.empty) {
    console.log(`  users/${uid}/${sub}: empty`);
    return 0;
  }

  console.log(`  users/${uid}/${sub}: found ${snap.size} document(s).`);

  if (dryRun) {
    console.log(`  [dry-run] Would delete ${snap.size} document(s).`);
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
    console.log(`  users/${uid}/${sub}: deleted ${deleted}/${snap.size}`);
  }

  return deleted;
}

console.log(
  dryRun
    ? "\n** DRY RUN — nothing will be deleted **\n"
    : "\nDeleting documents from Firestore...\n"
);

let totalDeleted = 0;

totalDeleted += await deleteSubcollection(ownerUid, "recipes");

if (includeTags) {
  totalDeleted += await deleteSubcollection(ownerUid, "tags");
}

console.log(
  dryRun
    ? `\n[dry-run] Would delete ${totalDeleted} document(s) total.\n`
    : `\nDone. Deleted ${totalDeleted} document(s) total.\n`
);

process.exit(0);
