#!/usr/bin/env node
/**
 * One-time migration: legacy top-level vault + hybrid ingredients → user-scoped layout.
 *
 * Writes:
 *   - ingredientCatalog/{id}           ← ingredients where catalog === true
 *   - users/{ownerId}/customIngredients/{id} ← ingredients where catalog === false
 *   - users/{uid}                        ← merge from userProfiles/{uid}
 *   - users/{uid}/recipes|pantry|tags|categories/{id} ← from top-level collections (same doc ids)
 *
 * Adds masterIngredientScope on recipe ingredient lines and pantry rows when inferable
 * from legacy ingredients/{masterIngredientId}.
 *
 * Usage:
 *   node scripts/migrate-to-user-scoped-firestore.mjs [--dry-run]
 *
 * Idempotency: skips destination docs that already have _migratedFromLegacyTopLevel === true.
 *
 * Requires: scripts/service-account.json (or GOOGLE_APPLICATION_CREDENTIALS).
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const MARK = "_migratedFromLegacyTopLevel";

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

/** @type {Map<string, { catalog: boolean, ownerId?: string }>} */
const legacyIngredientMeta = new Map();

async function loadLegacyIngredients() {
  const snap = await db.collection("ingredients").get();
  for (const d of snap.docs) {
    const data = d.data();
    legacyIngredientMeta.set(d.id, {
      catalog: data.catalog === true,
      ownerId: typeof data.ownerId === "string" ? data.ownerId : undefined,
    });
  }
  console.log(`Loaded ${legacyIngredientMeta.size} legacy ingredient document(s) for scope inference.`);
}

function inferScope(masterIngredientId) {
  if (!masterIngredientId || typeof masterIngredientId !== "string") {
    return null;
  }
  const meta = legacyIngredientMeta.get(masterIngredientId);
  if (!meta) return null;
  return meta.catalog ? "catalog" : "custom";
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function backfillIngredientLines(ingredients) {
  if (!Array.isArray(ingredients)) return ingredients;
  return ingredients.map((line) => {
    if (!line || typeof line !== "object" || line.isSection) return line;
    const mid = line.masterIngredientId;
    if (!mid || line.masterIngredientScope === "catalog" || line.masterIngredientScope === "custom") {
      return line;
    }
    const scope = inferScope(mid);
    if (!scope) return line;
    return { ...line, masterIngredientScope: scope };
  });
}

function backfillPantryRow(data) {
  const mid = data.masterIngredientId;
  if (!mid || data.masterIngredientScope === "catalog" || data.masterIngredientScope === "custom") {
    return data;
  }
  const scope = inferScope(mid);
  if (!scope) return data;
  return { ...data, masterIngredientScope: scope };
}

async function shouldSkip(destRef) {
  const snap = await destRef.get();
  if (!snap.exists) return false;
  return snap.data()?.[MARK] === true;
}

async function commitBatch(batch, label) {
  if (dryRun) return;
  await batch.commit();
  console.log(`  committed batch (${label})`);
}

async function migrateLegacyIngredients() {
  const snap = await db.collection("ingredients").get();
  let cat = 0;
  let cust = 0;
  let skipped = 0;
  let batch = db.batch();
  let pending = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const isCatalog = data.catalog === true;
    const ownerId = data.ownerId;

    if (isCatalog) {
      const dest = db.collection("ingredientCatalog").doc(d.id);
      if (await shouldSkip(dest)) {
        skipped++;
        continue;
      }
      const { catalog: _c, ownerId: _o, ...rest } = data;
      if (dryRun) {
        cat++;
        continue;
      }
      batch.set(
        dest,
        stripUndefined({
          ...rest,
          [MARK]: true,
          migratedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
      cat++;
      pending++;
    } else {
      if (!ownerId) {
        console.warn(`  skip custom ingredient ${d.id}: missing ownerId`);
        continue;
      }
      const dest = db.collection("users").doc(ownerId).collection("customIngredients").doc(d.id);
      if (await shouldSkip(dest)) {
        skipped++;
        continue;
      }
      const { catalog: _c, ownerId: _o, ...rest } = data;
      if (dryRun) {
        cust++;
        continue;
      }
      batch.set(
        dest,
        stripUndefined({
          ...rest,
          [MARK]: true,
          migratedAt: FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
      cust++;
      pending++;
    }

    if (pending >= 400) {
      await commitBatch(batch, "ingredients");
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await commitBatch(batch, "ingredients-final");

  console.log(
    `${dryRun ? "[dry-run] " : ""}ingredients → ingredientCatalog: ${cat}, customIngredients: ${cust}, skipped (already migrated): ${skipped}`
  );
}

async function migrateUserProfiles() {
  const snap = await db.collection("userProfiles").get();
  let n = 0;
  let skipped = 0;
  for (const d of snap.docs) {
    const dest = db.collection("users").doc(d.id);
    if (await shouldSkip(dest)) {
      skipped++;
      continue;
    }
    const data = d.data();
    if (dryRun) {
      console.log(`[dry-run] userProfiles/${d.id} → users/${d.id}`);
      n++;
      continue;
    }
    await dest.set(
      {
        ...stripUndefined(data),
        [MARK]: true,
        migratedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    n++;
  }
  console.log(`${dryRun ? "[dry-run] " : ""}userProfiles → users: ${n} merged, skipped: ${skipped}`);
}

async function migrateTopLevelUserCollection(collName, subName, transformDoc) {
  const snap = await db.collection(collName).get();
  let moved = 0;
  let skipped = 0;
  let skippedNoOwner = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const uid = data.ownerId;
    if (!uid) {
      skippedNoOwner++;
      continue;
    }
    const dest = db.collection("users").doc(uid).collection(subName).doc(d.id);
    if (await shouldSkip(dest)) {
      skipped++;
      continue;
    }
    const { ownerId: _o, ...rest } = data;
    const payload = transformDoc
      ? transformDoc(rest, d.id)
      : { ...rest, [MARK]: true, migratedAt: FieldValue.serverTimestamp() };

    if (dryRun) {
      moved++;
      continue;
    }
    batch.set(dest, stripUndefined(payload), { merge: true });
    batchCount++;
    moved++;
    if (batchCount >= 400) {
      await commitBatch(batch, `${collName}-batch`);
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0 && !dryRun) await commitBatch(batch, `${collName}-final`);

  console.log(
    `${dryRun ? "[dry-run] " : ""}${collName} → users/*/${subName}: ${moved} doc(s), skipped migrated: ${skipped}, no ownerId: ${skippedNoOwner}`
  );
}

async function main() {
  console.log(dryRun ? "** DRY RUN — no writes **\n" : "** LIVE MIGRATION **\n");

  await loadLegacyIngredients();
  await migrateLegacyIngredients();
  await migrateUserProfiles();

  await migrateTopLevelUserCollection("recipes", "recipes", (rest) => ({
    ...rest,
    ingredients: backfillIngredientLines(rest.ingredients),
    [MARK]: true,
    migratedAt: FieldValue.serverTimestamp(),
  }));

  await migrateTopLevelUserCollection("pantry", "pantry", (rest) =>
    backfillPantryRow({
      ...rest,
      [MARK]: true,
      migratedAt: FieldValue.serverTimestamp(),
    })
  );

  await migrateTopLevelUserCollection("tags", "tags", (rest) => ({
    ...rest,
    [MARK]: true,
    migratedAt: FieldValue.serverTimestamp(),
  }));

  await migrateTopLevelUserCollection("categories", "categories", (rest) => ({
    ...rest,
    [MARK]: true,
    migratedAt: FieldValue.serverTimestamp(),
  }));

  console.log("\nDone. Deploy updated client + Firestore rules when ready.");
  console.log(
    "Optional cleanup (destructive): delete legacy top-level collections after verifying the app."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
