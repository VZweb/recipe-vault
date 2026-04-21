#!/usr/bin/env node
/**
 * Sets or clears Firebase Auth custom claim `catalogAdmin` on a user.
 * That user may create/update/delete shared `ingredientCatalog` documents
 * (see firestore.rules). Everyone else sees catalog rows read-only.
 *
 * Usage:
 *   node scripts/set-catalog-admin-claim.mjs --uid=FIREBASE_AUTH_UID
 *   node scripts/set-catalog-admin-claim.mjs --uid=FIREBASE_AUTH_UID --revoke
 *
 * After granting, the user must refresh their ID token (sign out and back in,
 * or wait for natural refresh) before the app and rules see the claim.
 *
 * Requires scripts/service-account.json or GOOGLE_APPLICATION_CREDENTIALS.
 */

import fs from "node:fs";
import path from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const uidArg = args.find((a) => a.startsWith("--uid="));
const uid = uidArg?.slice("--uid=".length).trim();

const scriptDir = import.meta.dirname;
const saPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(scriptDir, "service-account.json");

if (!uid) {
  console.error("Usage: node scripts/set-catalog-admin-claim.mjs --uid=YOUR_AUTH_UID [--revoke]");
  process.exit(1);
}

if (!fs.existsSync(saPath)) {
  console.error(`Service account key not found: ${saPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

const user = await auth.getUser(uid);
const nextClaims = { ...(user.customClaims ?? {}) };
if (revoke) {
  delete nextClaims.catalogAdmin;
} else {
  nextClaims.catalogAdmin = true;
}

await auth.setCustomUserClaims(uid, nextClaims);

console.log(
  revoke
    ? `Removed catalogAdmin claim from ${uid}.`
    : `Set catalogAdmin=true on ${uid}. Sign out and back in (or wait) so the client picks up the new token.`
);

process.exit(0);
