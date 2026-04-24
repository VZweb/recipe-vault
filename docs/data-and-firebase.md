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

Recipes store arrays of ingredient lines (with optional `masterIngredientId` + `masterIngredientScope`: `catalog` | `custom` | null for legacy, plus optional **`substituteLinks`**: array of `{ masterIngredientId, masterIngredientScope }` for other masters that satisfy the same line for pantry matching and suggestions), steps, optional `categoryId`, `tags` (array of tag document IDs), `imageUrls`, timestamps (`createdAt`, `updatedAt`), and `cookedCount`. `docToRecipe` normalizes missing fields when reading (including default `substituteLinks: []`). The recipe list’s **multi-tag filter** is **AND**: `fetchRecipes` uses `array-contains` on the first tag id, then filters the rest in memory.

**Alternatives UX:** Users edit `substituteLinks` in [`RecipeEditorPage`](../src/pages/RecipeEditorPage.tsx) (inside each ingredient card). [`RecipeDetailPage`](../src/pages/RecipeDetailPage.tsx) shows linked alternatives read-only under the line name. Behavior and matching rules are described in [Domain logic — Recipe ingredient alternatives (substituteLinks)](./domain-logic.md#recipe-ingredient-alternatives-substitutelinks).

Deleting a recipe removes linked Storage objects best-effort (`deleteRecipe` + `deleteRecipeImage`).

### Tags and categories

- **Delete tag**: batches removal of that tag id from every recipe’s `tags` array under the same user, then deletes the tag document.
- **Delete category**: sets `categoryId` to `null` on affected recipes, then deletes the category.

### Pantry

**Path:** `users/{uid}/pantry`. **Reads:** [`fetchPantryItems`](../src/lib/firestore.ts) uses `orderBy("name")`; the client then sorts by category and name for grouped display.

**Document fields (conceptual):** name, optional secondary name, normalized name, category, optional quantity and unit, `isStaple`, optional `imageUrl`, `masterIngredientId` + `masterIngredientScope` when linked to the shared catalog or user **custom** master ingredients, `note`, `addedAt`. Optional freshness: **`expiresOn`** — calendar date string **`YYYY-MM-DD`** or `null` / omitted; **`isOpened`** — boolean, default `false` for legacy docs. [`docToPantryItem`](../src/lib/firestore.ts) normalizes reads (including validating `expiresOn`). [`updatePantryItem`](../src/lib/firestore.ts) strips `undefined` from partial updates before `updateDoc` so optional clears (e.g. `expiresOn: null`) stay valid.

**Deletes:** removing a pantry document also removes its Storage image when `imageUrl` is set ([`deletePantryImage`](../src/lib/storage.ts), invoked from [`deletePantryItem`](../src/lib/firestore.ts)).

**Types and helpers:** [`src/types/pantry.ts`](../src/types/pantry.ts); expiry display rules and labels in [`src/lib/pantryExpiry.ts`](../src/lib/pantryExpiry.ts) (see [Domain logic](./domain-logic.md#pantry-expiry-and-opened-ux)); main UI in [`src/pages/PantryPage.tsx`](../src/pages/PantryPage.tsx). Adding from the catalog on **Ingredients** uses [`addPantryItem`](../src/lib/firestore.ts) with `expiresOn: null` and `isOpened: false`. **Suggestions** builds synthetic pantry rows with the same defaults when extras are merged ([`SuggestionsPage`](../src/pages/SuggestionsPage.tsx)).

**Pantry UI (collapsed row):** Each item is a card whose **border and background** reflect expiry: neutral stone/white when there is no date or the date is outside the warning window; **amber** when the calendar date is within the configured warning days (inclusive of “expires today”); **red** when the date is in the past. The row **expands** from a primary control (`aria-expanded` / `aria-controls`) to show read-only details below. **Edit** and **Delete** sit in a column on the right; **Staple / Unstaple** is only in the **edit** form (Save / Cancel row), not on the collapsed row. Under the action buttons, an optional **icon strip** (right-aligned) shows circular chips for **Opened**, **Staple**, and **Calendar** when an expiry date exists (calendar is icon-only for “calm” future dates). The **catalog link** icon (`Link2`) appears **inline after the ingredient name** (and optional Greek name), not in that strip. **Expiry text** under the quantity appears **only** when the item is expired or inside the warning window (same copy as [`getPantryExpiryAlertMessage`](../src/lib/pantryExpiry.ts)); otherwise no line there—only the calendar chip indicates a date is set.

**Pantry UI (expanded block):** A simple stacked list with dividers: expiry (value or “Not set”), **Opened** row only if `isOpened`, optional amount, optional note, and **Added** date.

**Pantry UI (add / edit):** Optional expiry (`<input type="date">` → `expiresOn`), **Opened** checkbox, and the rest of the existing fields. When an item is linked to the catalog, primary and Greek name fields are read-only in edit, with the same disabled look for both.

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
