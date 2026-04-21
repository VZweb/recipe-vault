# Domain logic

Pure and Firebase-adjacent logic that defines product behavior beyond CRUD. Primary modules: `src/lib/search.ts`, `src/lib/suggestions.ts`, `src/lib/normalize.ts`, `src/lib/parseIngredients.ts`, `src/lib/parseSteps.ts`.

## Client-side search (`search.ts`)

- `buildSearchIndex` takes recipes, tags, categories, and master ingredients and returns a **Fuse.js** instance.
- Each recipe is augmented into a `SearchableRecipe`: resolved tag names, category name, and a flattened `ingredientNames` string (primary and secondary names, Greek name and aliases from linked master ingredients via `resolveMasterIngredient` using `masterIngredientScope`; section headers excluded).
- Fuse keys and weights: `title` (3), `ingredientNames` (2), `tagNames` (2), `categoryName` (2), `description` (1). Options include `threshold: 0.35`, `ignoreLocation: true`, `minMatchCharLength: 2`.

If search behavior or fields change, update this doc and any UX copy that refers to “what is searchable.”

## Suggestions (`suggestions.ts`)

`suggestRecipes(recipes, pantryItems)`:

- Builds a `Set` of stable link keys from pantry rows (`ingredientLinkKey` from `masterIngredientId` + `masterIngredientScope`; legacy null scope uses a dedicated bucket so old data still matches).
- For each recipe, walks non-section ingredients: if the line’s link key is in the set, counts as matched; otherwise missing.
- Computes `matchPercentage` from matched vs total non-section ingredients.
- Returns only recipes with at least one match, sorted by descending match percentage.

Pantry and recipe ingredients must stay linked to master ingredients for meaningful results.

## Normalization (`normalize.ts`)

`normalizeText` supports **Greek-aware** matching: lowercases, trims, NFD accent stripping, folds final sigma (ς → σ), collapses whitespace. Used where ingredient or name matching must be tolerant of spelling variants.

## Parsing helpers

- `parseIngredients.ts` — splits pasted ingredient text into structured lines (used by the recipe editor flow).
- `parseSteps.ts` — splits pasted step text into ordered steps.

When input formats or output shapes change, update this section and any user-facing hints in the editor.

## Seeds

`src/lib/pantrySeeds.ts` provides starter data for pantry UX; keep in sync if seed structure changes.
