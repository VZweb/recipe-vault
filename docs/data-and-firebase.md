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

## Firestore collections

Collection names and mapping logic live in `src/lib/firestore.ts`.

| Collection | Purpose | Ordering / queries used |
|------------|---------|-------------------------|
| `recipes` | Recipe documents | `where("ownerId","==",uid)` plus `orderBy("createdAt","desc")` or filters on `tags` / `categoryId` (composite indexes required). |
| `tags` | Tag metadata | `where("ownerId","==",uid)`, `orderBy("name")` |
| `categories` | Recipe categories | `where("ownerId","==",uid)`, `orderBy("name")` |
| `pantry` | Pantry items | `where("ownerId","==",uid)`, `orderBy("name")`, then client sort by category and name |
| `ingredients` | Master ingredient catalog | Two queries merged in the client: `where("catalog","==",true)` and `where("ownerId","==",uid)`, each with `orderBy("name")` |
| `userProfiles` | Per-user metadata | One document per uid (`userProfiles/{uid}`). Used to record `vaultDefaultsApplied` after starter tags/categories are copied for new accounts (`ensureUserVaultDefaults` in `firestore.ts`). |

### Recipe documents

Recipes store **`ownerId`**, arrays of ingredient lines and step strings, optional `categoryId`, `tags` (array of tag document IDs), `imageUrls`, timestamps (`createdAt`, `updatedAt`), and `cookedCount`. `docToRecipe` normalizes missing fields when reading.

Deleting a recipe removes linked Storage objects best-effort (`deleteRecipe` + `deleteRecipeImage`).

### Tags and categories

- **Delete tag**: batches removal of that tag id from every **owned** recipe’s `tags` array, then deletes the tag document.
- **Delete category**: sets `categoryId` to `null` on affected **owned** recipes, then deletes the category.

### Pantry

Pantry items store **`ownerId`** and reference `masterIngredientId` (string). Deleting a pantry item removes its `imageUrl` file from Storage when present (dynamic import of `deletePantryImage`).

### Master ingredients

Stored in the `ingredients` collection. **Catalog** rows (`catalog: true`) are shared defaults for every user; only accounts with the **`catalogAdmin`** Auth custom claim may create, update, or delete them from the client (see `scripts/set-catalog-admin-claim.mjs` and `firestore.rules`). **User** rows (`ownerId` set, `catalog: false`) are editable by that owner. `docToMasterIngredient` sets `isCatalog` for the UI.

### Default tags and categories for new accounts

Starter lists live in [`src/data/defaultVaultTemplates.ts`](../src/data/defaultVaultTemplates.ts). On sign-in, `ensureUserVaultDefaults()` runs once per account (see `userProfiles`): if the user has **no** tags and/or **no** categories, it copies the templates into `tags` / `categories` with that user’s `ownerId`. Existing users who already have both tags and categories only get `userProfiles` marked so the seed does not run again.

## TypeScript types

Canonical shapes are in `src/types/` (`recipe.ts`, `tag.ts`, `category.ts`, `pantry.ts`, `ingredient.ts`). When you change Firestore fields, update both the mapper in `firestore.ts` and the corresponding types.

## Firebase Storage paths

Implemented in `src/lib/storage.ts`:

- Recipe images: `recipes/{uid}/files/{timestamp-random}.{ext}`
- Pantry images: `pantry/{uid}/{itemId}/{timestamp-random}.{ext}`

Download URLs are stored on documents (`imageUrls` on recipes, `imageUrl` on pantry items).

## Indexes

Composite indexes for `ownerId` (and `catalog`) combinations live in [`firestore.indexes.json`](../firestore.indexes.json). Deploy with `firebase deploy --only firestore:indexes` (or full `firebase deploy`) after the console prompts you if a query fails in development.

## Data migrations

- **Catalog flag:** from the repository root, `node scripts/backfill-ingredients-catalog.mjs` — sets `catalog: true` on ingredient docs that are not user-owned.
- **Existing vault data:** `node scripts/backfill-vault-owner.mjs --owner-uid=YOUR_UID` — assigns `ownerId` on legacy `recipes`, `tags`, `categories`, and `pantry` documents missing it so they appear for that account after rules tighten.
- **Recipe import:** `scripts/import-recipes.mjs` requires `--owner-uid=` for real writes so imported recipes and new tags are owned by that user.
