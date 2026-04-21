# Operations

## Environment variables

Copy `.env.example` to `.env` and set:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Vite exposes only variables prefixed with `VITE_` to the client bundle.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b` then production Vite build (`NODE_OPTIONS='--max-old-space-size=4096'` for the Node heap during build) |
| `npm run preview` | Serve the `dist` output locally |
| `npm run lint` | ESLint |
| `npm run deploy` | `npm run build` then `firebase deploy` |

### Firestore maintenance (Node + Admin SDK)

These scripts expect a service account JSON at `scripts/service-account.json` or `GOOGLE_APPLICATION_CREDENTIALS` (same as `scripts/import-recipes.mjs`).

| Script | Purpose |
|--------|---------|
| `node scripts/migrate-to-user-scoped-firestore.mjs [--dry-run]` | Copy legacy top-level vault + `ingredients` + `userProfiles` into `users/{uid}/…`, `ingredientCatalog`, and backfill `masterIngredientScope`. Run in dev/staging first. |
| `node scripts/set-catalog-admin-claim.mjs --uid=FIREBASE_AUTH_UID` | Set custom claim `catalogAdmin` so that user may edit `ingredientCatalog` from the app (`--revoke` removes the claim). |
| `node scripts/backfill-ingredients-catalog.mjs` | **Legacy only:** old top-level `ingredients` collection. Prefer the migrate script for current layout. |
| `node scripts/backfill-vault-owner.mjs --owner-uid=FIREBASE_UID` | **Legacy only:** set `ownerId` on old top-level vault docs. |
| `node scripts/export-user-vault-templates.mjs --uid=FIREBASE_UID [--write]` | Dump that user’s `users/{uid}/tags` and `users/{uid}/categories` as TypeScript for `src/data/defaultVaultTemplates.ts` (`--write` overwrites the file; omits tag names containing U+FFFD from bad imports). |
| `node scripts/seed-categories-tags.mjs --owner-uid=FIREBASE_UID [--dry-run]` | Seed curated tags/categories under `users/{uid}/…`. |

**Deploy order (typical):** run `migrate-to-user-scoped-firestore.mjs` (or start on a fresh project), deploy `firestore.indexes.json` if you added composites, deploy `firestore.rules`, then deploy the web app. Enable **Authentication** providers in the Firebase console first.

## Firebase Hosting

`firebase.json` sets `hosting.public` to `dist` and SPA rewrites: all paths serve `index.html`. Firestore rules file: `firestore.rules`; Storage rules: `storage.rules`; indexes: `firestore.indexes.json`.

Deploy requires the Firebase CLI, project selection, and appropriate IAM on the Firebase project.

### Storage rules deploy: “Converting circular structure to JSON” / default bucket

If `firebase deploy --only firestore:rules,storage` fails while **fetching the default storage bucket** with `TypeError: Converting circular structure to JSON`, the Firebase CLI is mishandling an underlying API error. Try, in order:

1. **Deploy Firestore rules alone** (unblocks the app for Firestore):  
   `firebase deploy --only firestore:rules`
2. **Upgrade the CLI** (often fixes bucket discovery):  
   `npm install -g firebase-tools@latest`
3. **Confirm Storage is enabled** in the Firebase console (**Build → Storage** → complete setup if you never did).
4. **`firebase.json`** lists an explicit bucket for this project (`recipe-vault-4fc8c.appspot.com`). If your console shows a **different** default bucket (for example `*.firebasestorage.app` on newer projects), replace the `bucket` value in the `storage` array with the exact name from **Storage → Files** (without the `gs://` prefix).

Then run:  
`firebase deploy --only storage`  
(or again `firebase deploy --only firestore:rules,storage`).

## Adding features that affect ops

Document new env vars in `.env.example` and this file. Document new Firebase products (e.g. Auth, Functions) here and in [Architecture](./architecture.md) / [Security](./security.md) as applicable.
