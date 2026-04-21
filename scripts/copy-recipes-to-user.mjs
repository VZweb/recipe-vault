#!/usr/bin/env node
/**
 * Copy specific recipe documents from one user to another under
 * users/{uid}/recipes/{recipeId}.
 *
 * Usage:
 *   node scripts/copy-recipes-to-user.mjs \
 *     --from-uid=SOURCE_AUTH_UID \
 *     --to-uid=DEST_AUTH_UID \
 *     --ids=recipeDocId1,recipeDocId2
 *
 *   node scripts/copy-recipes-to-user.mjs \
 *     --from-uid=SOURCE \
 *     --to-uid=DEST \
 *     --ids-file=./recipe-ids.txt
 *
 * Options:
 *   --dry-run        Log actions without writing
 *   --overwrite      Replace destination doc when the same recipe id already exists
 *   --new-ids        Create new random document ids on the destination (prints id map)
 *   --strip-refs     Set categoryId to null and tags to [] on the copy (avoids broken
 *                    pointers if the destination user has different category/tag ids)
 *
 * Requires: scripts/service-account.json (or GOOGLE_APPLICATION_CREDENTIALS).
 *
 * Note: By default, categoryId and tags[] are copied as-is. Those values are document ids
 * in the *source* user's tags/categories; on the destination they may not exist unless
 * both vaults share the same ids (e.g. cloned templates). Use --strip-refs if unsure.
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const overwrite = args.includes("--overwrite");
const newIds = args.includes("--new-ids");
const stripRefs = args.includes("--strip-refs");

function argVal(prefix) {
  const a = args.find((x) => x.startsWith(prefix));
  return a?.slice(prefix.length)?.trim() ?? "";
}

/** Supports `--key=value` or `--key value`. */
function argValOrNext(longPrefix, shortKey) {
  const eq = argVal(longPrefix);
  if (eq) return eq;
  const i = args.findIndex((x) => x === shortKey);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("-")) {
    return args[i + 1].trim();
  }
  return "";
}

const fromUid = argVal("--from-uid=") || argValOrNext("--from-uid=", "--from-uid");
const toUid = argVal("--to-uid=") || argValOrNext("--to-uid=", "--to-uid");
const idsCsv = argVal("--ids=") || argValOrNext("--ids=", "--ids");
const idsFile = argVal("--ids-file=") || argValOrNext("--ids-file=", "--ids-file");

if (args.includes("--help")) {
  console.log(`
Copy recipes between users (Firestore user-scoped layout).

Usage:
  node scripts/copy-recipes-to-user.mjs --from-uid=SOURCE --to-uid=DEST --ids=id1,id2
  node scripts/copy-recipes-to-user.mjs --from-uid SOURCE --to-uid DEST --ids id1,id2
  node scripts/copy-recipes-to-user.mjs --from-uid=SOURCE --to-uid=DEST --ids-file=ids.txt

Options:
  --dry-run      No writes
  --overwrite    Overwrite destination recipe if id already exists
  --new-ids      Use new Firestore document ids on destination (logs old -> new)
  --strip-refs   Set categoryId null and tags [] on each copy

Requires scripts/service-account.json (or GOOGLE_APPLICATION_CREDENTIALS).
`);
  process.exit(0);
}

if (!fromUid || !toUid) {
  console.error(
    "Error: both --from-uid and --to-uid are required (Firebase Auth uids).\n" +
      `  Example: node scripts/copy-recipes-to-user.mjs --from-uid=SOURCE_UID --to-uid=DEST_UID --ids=2uaj5zyFKOep5Mgy1jnD\n` +
      `  Got: from-uid=${fromUid ? "(set)" : "(missing)"} to-uid=${toUid ? "(set)" : "(missing)"}`
  );
  process.exit(1);
}

/** @type {string[]} */
let recipeIds = [];
if (idsCsv) {
  recipeIds = idsCsv.split(",").map((s) => s.trim()).filter(Boolean);
} else if (idsFile) {
  if (!fs.existsSync(idsFile)) {
    console.error(`File not found: ${idsFile}`);
    process.exit(1);
  }
  recipeIds = fs
    .readFileSync(idsFile, "utf-8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
} else {
  console.error("Provide --ids=id1,id2 or --ids-file=path.txt");
  process.exit(1);
}

if (fromUid === toUid) {
  console.error("--from-uid and --to-uid must differ.");
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

const srcCol = db.collection("users").doc(fromUid).collection("recipes");
const destCol = db.collection("users").doc(toUid).collection("recipes");

function cleanForDest(data) {
  const { ownerId: _o, _migratedFromLegacyTopLevel: _m, ...rest } = data;
  const out = { ...rest };
  if (stripRefs) {
    out.categoryId = null;
    out.tags = [];
  }
  out.updatedAt = Timestamp.now();
  return out;
}

let copied = 0;
let skipped = 0;
let missing = 0;

for (const id of recipeIds) {
  const srcRef = srcCol.doc(id);
  const snap = await srcRef.get();
  if (!snap.exists) {
    console.warn(`  MISSING: users/${fromUid}/recipes/${id}`);
    missing++;
    continue;
  }

  const data = snap.data();
  const payload = cleanForDest(data);

  if (newIds) {
    if (dryRun) {
      console.log(`  [dry-run] would copy ${id} -> new doc under users/${toUid}/recipes`);
      copied++;
      continue;
    }
    const newRef = await destCol.add(payload);
    console.log(`  COPIED ${id} -> ${newRef.id}`);
    copied++;
    continue;
  }

  const destRef = destCol.doc(id);
  const destSnap = await destRef.get();
  if (destSnap.exists && !overwrite) {
    console.warn(`  SKIP (exists): users/${toUid}/recipes/${id} (use --overwrite)`);
    skipped++;
    continue;
  }

  if (dryRun) {
    console.log(
      `  [dry-run] would ${destSnap.exists ? "overwrite" : "create"} users/${toUid}/recipes/${id}`
    );
    copied++;
    continue;
  }

  await destRef.set(payload, { merge: false });
  console.log(`  ${destSnap.exists ? "OVERWROTE" : "COPIED"} -> users/${toUid}/recipes/${id}`);
  copied++;
}

console.log(`
Summary:
  requested: ${recipeIds.length}
  ${dryRun ? "[dry-run] would copy" : "copied"}: ${copied}
  skipped (dest exists): ${skipped}
  missing (no source doc): ${missing}
`);

if (!stripRefs && copied > 0) {
  console.log(
    "Tip: If category chips or tags look wrong for the destination user, re-run with --strip-refs or fix categoryId/tags in the console.\n"
  );
}

process.exit(missing === recipeIds.length ? 1 : 0);
