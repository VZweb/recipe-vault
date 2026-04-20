#!/usr/bin/env node
/**
 * Assigns `ownerId` to existing vault documents that are missing it, so they
 * become visible to that user after Firestore rules are tightened.
 *
 * Usage:
 *   node scripts/backfill-vault-owner.mjs --owner-uid=FIREBASE_AUTH_UID [--dry-run]
 *
 * Touches collections: recipes, tags, categories, pantry.
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const ownerArg = args.find((a) => a.startsWith("--owner-uid="));
const ownerUid = ownerArg?.slice("--owner-uid=".length)?.trim();

if (!ownerUid) {
  console.error("Required: --owner-uid=YOUR_FIREBASE_AUTH_UID");
  process.exit(1);
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
db.settings({ preferRest: true });

async function touchCollection(name) {
  const snap = await db.collection(name).get();
  let n = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.ownerId) continue;
    if (dryRun) {
      console.log(`[dry-run] ${name}/${doc.id}`);
      n++;
      continue;
    }
    await doc.ref.update({ ownerId: ownerUid });
    n++;
  }
  console.log(`${dryRun ? "[dry-run] " : ""}${name}: ${n} document(s) updated`);
}

for (const c of ["recipes", "tags", "categories", "pantry"]) {
  await touchCollection(c);
}

process.exit(0);
