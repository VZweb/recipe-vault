#!/usr/bin/env node
/**
 * Sets `catalog: true` on every ingredient document that is not user-owned
 * (no `ownerId` field). Required before strict Firestore rules so the shared
 * catalog remains readable.
 *
 * Usage:
 *   node scripts/backfill-ingredients-catalog.mjs [--dry-run]
 *
 * Requires scripts/service-account.json or GOOGLE_APPLICATION_CREDENTIALS.
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

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

const col = db.collection("ingredients");
const snap = await col.get();
let updated = 0;
let skipped = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  if (data.ownerId) {
    skipped++;
    continue;
  }
  if (data.catalog === true) {
    skipped++;
    continue;
  }
  if (dryRun) {
    console.log(`[dry-run] Would set catalog on ${doc.id}`);
    updated++;
    continue;
  }
  await doc.ref.update({ catalog: true });
  updated++;
}

console.log(
  dryRun
    ? `[dry-run] Would update ${updated} document(s); skipped ${skipped}.`
    : `Updated ${updated} catalog ingredient(s); skipped ${skipped}.`
);

process.exit(0);
