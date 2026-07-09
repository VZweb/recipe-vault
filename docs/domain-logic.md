# Domain logic

Pure and Firebase-adjacent logic that defines product behavior beyond CRUD. Primary modules: `src/lib/search.ts`, `src/lib/suggestions.ts`, `src/lib/normalize.ts`, `src/lib/parseIngredients.ts`, `src/lib/parseSteps.ts`, `src/lib/chatgptRecipeImport.ts`.

## Client-side search (`search.ts`)

- `buildSearchIndex` takes recipes, tags, categories, and master ingredients and returns a **Fuse.js** instance.
- Each recipe is augmented into a `SearchableRecipe`: resolved tag names, category name, and a flattened `ingredientNames` string (primary and secondary names, Greek name and aliases from linked master ingredients via `resolveMasterIngredient` using `masterIngredientScope`, plus names/aliases from any **`substituteLinks`** on the line; section headers excluded).
- Fuse keys and weights: `title` (3), `ingredientNames` (2), `tagNames` (2), `categoryName` (2), `description` (1). Options include `threshold: 0.35`, `ignoreLocation: true`, `minMatchCharLength: 2`.

If search behavior or fields change, update this doc and any UX copy that refers to “what is searchable.”

## Suggestions (`suggestions.ts`)

### Deep-link: focused ingredient on the Suggestions page

The app can open **`/suggestions?masterId=<id>&scope=catalog|custom`** (legacy masters may omit `scope` or use an empty value for the `?:` bucket). In-app sparkles navigation also passes the same payload via **`location.state.suggestionsSeed`** so seeding does not rely on the query string surviving navigation timing. Sparkles from **Pantry**, the **ingredient catalog**, or a **recipe line** (detail / editor) sets **`forceAsExtra`** so the ingredient is still added to the extra-ingredient criteria (chips / ranking) even when it is already in the real pantry—otherwise that navigation would be skipped as a duplicate link key. [`SuggestionsPage`](../src/pages/SuggestionsPage.tsx) reads **state first, then the URL**, once the pantry load finished and **master ingredients have been fetched at least once** (`mastersFetched`), **resolves the master** via [`resolveMasterIngredient`](../src/lib/ingredientRef.ts), and **appends one entry** to the same **`extraIngredients`** state used for “Extra ingredients I also have” — unless that ingredient’s **link key** is **already covered by a real pantry row**, in which case nothing is added (no redundant chip). State updates are applied with **`flushSync`** before clearing the URL so extras are not lost to React batching. [`suggestRecipes`](../src/lib/suggestions.ts) is unchanged.

After applying, the URL is **`replace`d** to plain `/suggestions` so a refresh does not re-seed the same extra. That trades **shareable pre-filled links** in the address bar for predictable refresh behavior. URL building and navigation live in [`suggestionsNavigation`](../src/lib/suggestionsNavigation.ts). Catalog, pantry, recipe detail, and recipe editor surfaces use a small **sparkles** control; recipe lines use the **primary** master when present, otherwise the **first substitute** with a master link.

`suggestRecipes(recipes, pantryItems)`:

- Builds a `Set` of stable link keys from pantry rows (`ingredientLinkKey` from `masterIngredientId` + `masterIngredientScope`; legacy null scope uses a dedicated bucket so old data still matches).
- For each recipe, walks non-section ingredients: if **any** of the line’s pantry link keys is in the set, counts as matched. Keys come from `ingredientLineLinkKeys` in `ingredientRef.ts` (primary `masterIngredientId` + `masterIngredientScope` plus each entry in `substituteLinks`). Otherwise missing.
- Computes `matchPercentage` from matched vs total non-section ingredients.
- Returns only recipes with at least one match, sorted by descending match percentage.

Pantry and recipe ingredients must stay linked to master ingredients for meaningful results. On **Suggestions**, “extra ingredients” are attributed to a recipe when any of the line’s keys (primary or substitute) matches the extra’s link key.

### ChatGPT recipe import (`chatgptRecipeImport.ts`)

On [`SuggestionsPage`](../src/pages/SuggestionsPage.tsx), **Ask ChatGPT** copies a pantry-aware prompt built by [`buildChatGptRecipePrompt`](../src/lib/chatgptRecipeImport.ts). The prompt asks ChatGPT for a human-readable recipe plus a machine-readable block at the end:

````text
```recipe-vault
{ "title": "...", "ingredients": [...], "steps": ["..."] }
```
````

**Import recipe** opens [`ImportRecipeDialog`](../src/components/recipe/ImportRecipeDialog.tsx). The user pastes the full ChatGPT reply (or uses **Read clipboard**). [`parseImportedRecipeText`](../src/lib/chatgptRecipeImport.ts) extracts JSON from the `recipe-vault` fence (fallback: a `json` fence containing `"title"` and `"ingredients"`, or raw JSON). Ingredients are linked to the master catalog via [`linkIngredientToCatalog`](../src/lib/parseIngredients.ts); unlinked lines still import as freeform names. **Add to vault** (default) calls `createRecipe` and navigates to the new private recipe. Users with the **`recipeLibraryAdmin`** custom claim see a **Save location** choice: **Shared library** uses `createSharedRecipe` (empty `tagNames`, no category) and navigates to `/shared/{id}`. **Edit first** opens `/recipes/new` with `location.state.importDraft` (and `importSaveToSharedLibrary` when applicable) so [`RecipeEditorPage`](../src/pages/RecipeEditorPage.tsx) seeds the form for review.

Import JSON fields: `title` (required), optional `description`, `servings`, `prepTimeMin`, `cookTimeMin`, `notes`, `imageUrls` (array of direct `http`/`https` image URLs; `imageUrl` string also accepted), `ingredients` (`name`, `quantity`, `unit`, `note`, `isSection`), and `steps` (string array). At least one of `ingredients` or `steps` is required. Invalid image URLs are skipped with a warning; external URLs are stored as-is (same as pasting a URL in the recipe editor).

## Recipe ingredient alternatives (substituteLinks)

Recipe lines can list **extra** linked masters that count as the same “slot” for pantry matching and suggestions. This is **recipe-scoped**: catalog and pantry still store each master (e.g. chicken breast vs wings) as separate documents; `substituteLinks` only declares that either key satisfies **this** line.

- **Shape:** On each non-section ingredient, optional **`substituteLinks`**: `{ masterIngredientId, masterIngredientScope }[]` (same scope rules as the primary link: `catalog` | `custom` | legacy `null`). Missing or legacy docs normalize to `[]` in [`docToRecipe`](../src/lib/firestore.ts).
- **Keys:** [`ingredientLineLinkKeys`](../src/lib/ingredientRef.ts) returns deduped pantry link keys for the primary plus every substitute. Consumers include [`suggestRecipes`](../src/lib/suggestions.ts), pantry checks on [`RecipeDetailPage`](../src/pages/RecipeDetailPage.tsx) (row highlight and “X / Y in pantry” count), and extra-ingredient attribution on [`SuggestionsPage`](../src/pages/SuggestionsPage.tsx).
- **Editor:** [`RecipeEditorPage`](../src/pages/RecipeEditorPage.tsx) — inside each ingredient card, above the reorder row: **Add alternative** opens catalog autocomplete (query state is local so typing works); chosen items appear as chips with remove. Choosing a new primary drops any substitute that duplicates that link.
- **Recipe detail:** [`RecipeDetailPage`](../src/pages/RecipeDetailPage.tsx) — when `substituteLinks` is non-empty, an **or** row under the line name lists resolved alternative names (small chips + catalog link icon). If the line is in pantry only via a substitute, the package icon tooltip names the matching alternative.
- **Search:** `buildSearchIndex` includes substitute masters’ names, Greek labels, and aliases in `ingredientNames` (see [Client-side search](#client-side-search-searchts) above).
- **Defaults:** [`parseIngredientText`](../src/lib/parseIngredients.ts) and URL import ([`importRecipeFromUrl`](../functions/src/importRecipeFromUrl.ts) / client mapping in [`importRecipeFromUrlClient`](../src/lib/importRecipeFromUrlClient.ts)) set `substituteLinks: []`; alternatives are added in the editor.

## Pantry expiry and opened UX

Implemented in [`src/lib/pantryExpiry.ts`](../src/lib/pantryExpiry.ts) and consumed by [`PantryPage`](../src/pages/PantryPage.tsx).

- **`expiresOn`:** stored and compared as a **local calendar date** in `YYYY-MM-DD` (validated when reading from Firestore). No dependency on `Date` parsing of raw strings in UI logic beyond the helper’s own parsing.
- **`PANTRY_EXPIRY_WARNING_DAYS`:** default **7**. If today is on or before the expiry day and the calendar distance to that day is **≤ this constant**, the item is treated as **expiring soon** (amber styling and alert copy). **Same calendar day as expiry** counts as “soon,” not as expired.
- **`getPantryExpiryDisplayStatus`:** returns `none` (no date), `ok` (date exists but outside the warning window and not past), `expiringSoon`, or `expired` (today is **after** the expiry calendar date in local time).
- **`getPantryExpiryAlertMessage`:** human-readable line for **expired** or **expiring soon** only; returns `null` when no message is needed (including when there is no `expiresOn`). Used for the **text under quantity** on the collapsed card.
- **`formatExpiresOnLabel`:** locale-formatted label for the **expanded details** panel and similar readouts.
- **`isOpened`:** boolean on the pantry document; the **Opened** row in the expanded details list is shown **only** when `true`. The collapsed card shows an **Opened** chip in the icon strip only when `true`.

Changing warning behavior or date semantics should start in `pantryExpiry.ts`, then align [`PantryPage`](../src/pages/PantryPage.tsx) and this doc.

## After cooking: pantry wizard (`pantryRecipeMatch.ts` + `CookPantryWizardDialog`)

When the user records a cook from [`RecipeDetailPage`](../src/pages/RecipeDetailPage.tsx), a dialog can walk **pantry rows that match** the recipe’s non-section ingredients (same link-key rules as elsewhere: [`ingredientLineLinkKeys`](../src/lib/ingredientRef.ts), primary vs `substituteLinks`). The queue is built in [`buildCookPantryQueue`](../src/lib/pantryRecipeMatch.ts) and **dedupes by pantry document id** so one pack is not offered twice if two lines resolve to it.

- **Empty queue:** Nothing matched → user can still **Count this cook** without pantry writes.
- **Non-empty:** First screen is the first pantry item; **Skip pantry — just count this cook** increments only (same callback as finish paths). Per row: **Save** (writes `quantity` / `unit` / `expiresOn` / `isOpened`), **Skip this item** (no write), **Remove from pantry** (with an extra confirm when the row is a **staple**). After the last row, a **Done — count this cook** step fires the same increment as the other success paths.
- **Reusable UI:** [`CookPantryWizardDialog`](../src/components/CookPantryWizardDialog.tsx) is prop-driven (`recipe`, `pantryItems`, `open`, `onOpenChange`, `onCountedCook`) so another control can open the same flow later.

If matching or dedupe rules change, update `pantryRecipeMatch.ts` and this section.

## Normalization (`normalize.ts`)

`normalizeText` supports **Greek-aware** matching: lowercases, trims, NFD accent stripping, folds final sigma (ς → σ), collapses whitespace. Used where ingredient or name matching must be tolerant of spelling variants.

## Parsing helpers

- `parseIngredients.ts` — splits pasted ingredient text into structured lines (used by the recipe editor flow). Each line includes `substituteLinks: []`; users add alternatives after paste in the editor.
- `parseSteps.ts` — splits pasted step text into ordered steps.

When input formats or output shapes change, update this section and any user-facing hints in the editor.

## Seeds

`src/lib/pantrySeeds.ts` provides starter data for pantry UX; keep in sync if seed structure changes.
