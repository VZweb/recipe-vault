#!/usr/bin/env node
/**
 * Deletes ALL documents under users/{uid}/recipes only.
 * Does not touch sharedRecipes, tags, categories, or pantry.
 *
 * Usage:
 *   node scripts/delete-user-vault-recipes.mjs --uid=FIREBASE_AUTH_UID
 *   node scripts/delete-user-vault-recipes.mjs --uid=UID --dry-run
 *
 * Requires: scripts/service-account.json or GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Note: This removes Firestore docs only; Storage objects under recipes/{uid}/...
 * are not deleted (use Console or a separate cleanup if you need to reclaim space).
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

function argVal(prefix) {
  const a = args.find((x) => x.startsWith(prefix));
  return a?.slice(prefix.length)?.trim() ?? "";
}

const uid =
  argVal("--uid=") ||
  (args.includes("--uid") && args[args.indexOf("--uid") + 1]) ||
  "";

if (!uid || args.includes("--help")) {
  console.log(`
Delete all recipe documents in users/{uid}/recipes (not sharedRecipes).

  --uid=UID      Firebase Auth uid
  --dry-run      Log only, no deletes

Requires scripts/service-account.json or GOOGLE_APPLICATION_CREDENTIALS.
`);
  process.exit(uid ? 0 : 1);
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

const col = db.collection("users").doc(uid).collection("recipes");
const snap = await col.get();

if (snap.empty) {
  console.log(`No documents in users/${uid}/recipes`);
  process.exit(0);
}

let deleted = 0;

for (let i = 0; i < snap.docs.length; i += 500) {
  const chunk = snap.docs.slice(i, i + 500);
  if (dryRun) {
    for (const d of chunk) {
      console.log(`[dry-run] would delete users/${uid}/recipes/${d.id}`);
      deleted += 1;
    }
  } else {
    const batch = db.batch();
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
    deleted += chunk.length;
  }
}

console.log(
  dryRun
    ? `[dry-run] Would delete ${deleted} recipe doc(s) under users/${uid}/recipes`
    : `Deleted ${deleted} recipe doc(s) under users/${uid}/recipes`
);

process.exit(0);
