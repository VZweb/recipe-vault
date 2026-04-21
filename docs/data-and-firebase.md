# Data and Firebase

The web client uses the Firebase JS SDK. There is no custom REST API: reads and writes go directly to Firestore and Storage from the browser.

**Client cache:** Tags, categories, and the master ingredients list are loaded through **TanStack Query** (see [Architecture](./architecture.md#server-state-cache-tanstack-query--phase-1)) so repeated navigations reuse cached reads within the configured `staleTime`. Query keys include the signed-in user’s **uid** so caches do not leak across accounts. Planned extensions for **pantry** and **recipe lists** are described in the [TanStack Query roadmap](./tanstack-query-roadmap.md). Until those phases ship, pantry and recipes are still fetched per page or legacy hooks.

## Initialization

`src/lib/firebase.ts` calls `initializeApp` with values from `import.meta.env` (`VITE_FIREBASE_*`). It exports:

- `auth` — Firebase Auth instance
- `db` — Firestore instance
- `storage` — Firebase Storage instance
- `requireUid()` — throws if no user is signed in (used from `firestore.ts` for vault writes)

Enable **Email/Password** and **Google** sign-in providers in the Firebase console, and add your hosting and localhost domains under **Authorized domains**.

## Firestore layout

Path helpers live in `src/lib/firestorePaths.ts`; reads/writes are implemented in `src/lib/firestore.ts`.

| Path | Purpose | Ordering / queries used |
|------|---------|-------------------------|
| `users/{uid}/recipes` | Recipe documents | `orderBy("createdAt","desc")`, or `where("tags","array-contains", …)` / `where("categoryId","==", …)` with client-side AND for extra tags |
| `users/{uid}/tags` | Tag metadata | `orderBy("name")` |
| `users/{uid}/categories` | Recipe categories | `orderBy("name")` |
| `users/{uid}/pantry` | Pantry items | `orderBy("name")`, then client sort by category and name |
| `ingredientCatalog` | Shared master ingredients | `orderBy("name")` |
| `users/{uid}/customIngredients` | User-created master ingredients | `orderBy("name")` |
| `users/{uid}` | User profile / flags | Document used for `vaultDefaultsApplied` etc. |

### Recipe documents

Recipes store arrays of ingredient lines (with optional `masterIngredientId` + `masterIngredientScope`: `catalog` | `custom` | null for legacy), steps, optional `categoryId`, `tags` (array of tag document IDs), `imageUrls`, timestamps (`createdAt`, `updatedAt`), and `cookedCount`. `docToRecipe` normalizes missing fields when reading. The recipe list’s **multi-tag filter** is **AND**: `fetchRecipes` uses `array-contains` on the first tag id, then filters the rest in memory.

Deleting a recipe removes linked Storage objects best-effort (`deleteRecipe` + `deleteRecipeImage`).

### Tags and categories

- **Delete tag**: batches removal of that tag id from every recipe’s `tags` array under the same user, then deletes the tag document.
- **Delete category**: sets `categoryId` to `null` on affected recipes, then deletes the category.

### Pantry

Pantry items reference `masterIngredientId` and `masterIngredientScope` when linked to the shared catalog or custom ingredients. Deleting a pantry item removes its `imageUrl` file from Storage when present (dynamic import of `deletePantryImage`).

### Master ingredients

**Catalog** documents live in `ingredientCatalog` (no per-user copy). **Custom** documents live in `users/{uid}/customIngredients`. The client merges both lists for autocomplete; `MasterIngredient.isCatalog` distinguishes them for writes.

### Default tags and categories for new accounts

Starter lists live in [`src/data/defaultVaultTemplates.ts`](../src/data/defaultVaultTemplates.ts). Regenerate them from a reference account with `node scripts/export-user-vault-templates.mjs --uid=... --write` (service account required). On sign-in, `ensureUserVaultDefaults()` runs once per account: if the user has **no** tags and/or **no** categories, it copies the templates into `users/{uid}/tags` and `users/{uid}/categories`. It records `vaultDefaultsApplied` on `users/{uid}`.

## TypeScript types

Canonical shapes are in `src/types/` (`recipe.ts`, `tag.ts`, `category.ts`, `pantry.ts`, `ingredient.ts`, `ingredientRef.ts`). When you change Firestore fields, update both the mapper in `firestore.ts` and the corresponding types.

## Firebase Storage paths

Implemented in `src/lib/storage.ts`:

- Recipe images: `recipes/{uid}/files/{timestamp-random}.{ext}`
- Pantry images: `pantry/{uid}/{itemId}/{timestamp-random}.{ext}`

Download URLs are stored on documents (`imageUrls` on recipes, `imageUrl` on pantry items).

## Indexes

[`firestore.indexes.json`](../firestore.indexes.json) may be empty if all queries use only automatic single-field indexes. If the console or CLI reports a missing composite index after a query change, add it there and deploy with `firebase deploy --only firestore:indexes`.

## Data migrations

- **Move legacy top-level collections into `users/{uid}` and split ingredients:** `node scripts/migrate-to-user-scoped-firestore.mjs [--dry-run]` (service account). Run in a dev project first; then deploy this app version and updated `firestore.rules`.
- **Legacy helpers (old top-level `ingredients` / `ownerId` model):** `scripts/backfill-ingredients-catalog.mjs`, `scripts/backfill-vault-owner.mjs` — kept for reference only after migration.
- **Recipe import:** `scripts/import-recipes.mjs` requires `--owner-uid=` for writes; it targets `users/{uid}/recipes` and `users/{uid}/tags`.
