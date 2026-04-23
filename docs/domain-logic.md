# Domain logic

Pure and Firebase-adjacent logic that defines product behavior beyond CRUD. Primary modules: `src/lib/search.ts`, `src/lib/suggestions.ts`, `src/lib/normalize.ts`, `src/lib/parseIngredients.ts`, `src/lib/parseSteps.ts`.

## Client-side search (`search.ts`)

- `buildSearchIndex` takes recipes, tags, categories, and master ingredients and returns a **Fuse.js** instance.
- Each recipe is augmented into a `SearchableRecipe`: resolved tag names, category name, and a flattened `ingredientNames` string (primary and secondary names, Greek name and aliases from linked master ingredients via `resolveMasterIngredient` using `masterIngredientScope`, plus names/aliases from any **`substituteLinks`** on the line; section headers excluded).
- Fuse keys and weights: `title` (3), `ingredientNames` (2), `tagNames` (2), `categoryName` (2), `description` (1). Options include `threshold: 0.35`, `ignoreLocation: true`, `minMatchCharLength: 2`.

If search behavior or fields change, update this doc and any UX copy that refers to “what is searchable.”

## Suggestions (`suggestions.ts`)

`suggestRecipes(recipes, pantryItems)`:

- Builds a `Set` of stable link keys from pantry rows (`ingredientLinkKey` from `masterIngredientId` + `masterIngredientScope`; legacy null scope uses a dedicated bucket so old data still matches).
- For each recipe, walks non-section ingredients: if **any** of the line’s pantry link keys is in the set, counts as matched. Keys come from `ingredientLineLinkKeys` in `ingredientRef.ts` (primary `masterIngredientId` + `masterIngredientScope` plus each entry in `substituteLinks`). Otherwise missing.
- Computes `matchPercentage` from matched vs total non-section ingredients.
- Returns only recipes with at least one match, sorted by descending match percentage.

Pantry and recipe ingredients must stay linked to master ingredients for meaningful results. On **Suggestions**, “extra ingredients” are attributed to a recipe when any of the line’s keys (primary or substitute) matches the extra’s link key.

## Pantry expiry and opened UX

Implemented in [`src/lib/pantryExpiry.ts`](../src/lib/pantryExpiry.ts) and consumed by [`PantryPage`](../src/pages/PantryPage.tsx).

- **`expiresOn`:** stored and compared as a **local calendar date** in `YYYY-MM-DD` (validated when reading from Firestore). No dependency on `Date` parsing of raw strings in UI logic beyond the helper’s own parsing.
- **`PANTRY_EXPIRY_WARNING_DAYS`:** default **7**. If today is on or before the expiry day and the calendar distance to that day is **≤ this constant**, the item is treated as **expiring soon** (amber styling and alert copy). **Same calendar day as expiry** counts as “soon,” not as expired.
- **`getPantryExpiryDisplayStatus`:** returns `none` (no date), `ok` (date exists but outside the warning window and not past), `expiringSoon`, or `expired` (today is **after** the expiry calendar date in local time).
- **`getPantryExpiryAlertMessage`:** human-readable line for **expired** or **expiring soon** only; returns `null` when no message is needed (including when there is no `expiresOn`). Used for the **text under quantity** on the collapsed card.
- **`formatExpiresOnLabel`:** locale-formatted label for the **expanded details** panel and similar readouts.
- **`isOpened`:** boolean on the pantry document; the **Opened** row in the expanded details list is shown **only** when `true`. The collapsed card shows an **Opened** chip in the icon strip only when `true`.

Changing warning behavior or date semantics should start in `pantryExpiry.ts`, then align [`PantryPage`](../src/pages/PantryPage.tsx) and this doc.

## Normalization (`normalize.ts`)

`normalizeText` supports **Greek-aware** matching: lowercases, trims, NFD accent stripping, folds final sigma (ς → σ), collapses whitespace. Used where ingredient or name matching must be tolerant of spelling variants.

## Parsing helpers

- `parseIngredients.ts` — splits pasted ingredient text into structured lines (used by the recipe editor flow).
- `parseSteps.ts` — splits pasted step text into ordered steps.

When input formats or output shapes change, update this section and any user-facing hints in the editor.

## Seeds

`src/lib/pantrySeeds.ts` provides starter data for pantry UX; keep in sync if seed structure changes.
