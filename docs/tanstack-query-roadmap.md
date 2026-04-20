# TanStack Query migration roadmap

This document records **planned phases** for moving Firestore reads into [TanStack Query](https://tanstack.com/query/latest). **Phase 1 is implemented** (reference lists). Use this file when resuming work so scope and touch points stay clear.

**Implemented today:** tags, categories, master ingredients — see [Architecture → Server state cache](./architecture.md#server-state-cache-tanstack-query--phase-1) and `src/lib/queryKeys.ts`. Query keys include the signed-in user’s **Firebase uid** (e.g. `['tags', uid]`) so the cache stays scoped per account.

---

## Phase 2 — Pantry list (`fetchPantryItems`)

### Goal

Today the full pantry collection is loaded independently in four places. Phase 2 introduces **one cached query** so navigating between Pantry, Suggestions, recipe detail, and Ingredients does not repeat the same `getDocs` for `pantry` while data is fresh.

### Proposed query contract

| Item | Suggestion |
|------|------------|
| **Query key** | `['pantry']` in `queryKeys.ts` (add next to existing keys). |
| **Query function** | `fetchPantryItems` from `src/lib/firestore.ts` (unchanged Firestore API). |
| **`staleTime`** | Reuse `REFERENCE_DATA_STALE_MS` or introduce `PANTRY_STALE_MS` in `queryKeys.ts` if pantry should refresh on a different cadence than tags (often the same order of magnitude is fine). |
| **Hook** | New `usePantry()` in `src/hooks/` returning `{ items` or `pantryItems`, `loading`, `refresh`, … }` aligned with current UX; or export a thin `useQuery` wrapper plus mutation helpers. |

### Files that currently call `fetchPantryItems` (replace with hook / shared cache)

1. `src/pages/PantryPage.tsx` — main list; owns add/update/delete/clear flows.
2. `src/pages/SuggestionsPage.tsx` — loads pantry for `suggestRecipes`.
3. `src/pages/RecipeDetailPage.tsx` — loads pantry for “in pantry” hints.
4. `src/pages/IngredientsPage.tsx` — `loadPantryIds` builds a `Set` of `masterIngredientId`; can **derive from cached pantry** once Phase 2 exists (no second fetch pattern).

### Mutations and cache consistency

After any successful write to the `pantry` collection, update or invalidate the `['pantry']` query:

- **Add / update / delete item** on `PantryPage` (and **add from pantry** on `IngredientsPage` via `addPantryItem`).
- **Delete with image** path in `firestore.ts` / `PantryPage` that removes Storage then doc.

**Options:**

- **`setQueryData`** after each mutation (matches Phase 1 style; avoids an extra read if you merge locally), or  
- **`invalidateQueries({ queryKey: ['pantry'] })`** (simpler; one extra `getDocs` after each write).

Pick one strategy and use it consistently for pantry.

### Acceptance checklist (when Phase 2 is done)

- [ ] `queryKeys` includes `pantry`.
- [ ] No remaining direct `fetchPantryItems()` calls inside pages except possibly inside the single `queryFn` for `['pantry']`.
- [ ] After pantry mutations, list views on other routes show updated data without a full page reload.
- [ ] Update [Architecture](./architecture.md#server-state-cache-tanstack-query--phase-1) and [Data and Firebase](./data-and-firebase.md) to state pantry is cached.

---

## Phase 3 — Recipe lists (`useRecipes` / `fetchRecipes`)

### Goal

`useRecipes` in `src/hooks/useRecipes.ts` still runs `useEffect` + `fetchRecipes` on mount and whenever `tagFilter` / `categoryFilter` change. Phase 3 moves that to **`useQuery`** with a **key that includes filter arguments**, so:

- Navigating **Home → Recipes → Home** within `staleTime` can reuse the **unfiltered** list cache.
- Filtered lists (`array-contains-any` on tags, category id) get **separate cache entries** per distinct key.

### Firestore behavior to respect (see `fetchRecipes` in `src/lib/firestore.ts`)

- Unfiltered: `orderBy("createdAt", "desc")`.
- Tag filter: `where("tags", "array-contains-any", tagIds)` — Firestore allows **at most 10** tag ids; the hook/query layer should not invent keys with more than 10 without a documented strategy.
- Category filter: `where("categoryId", "==", categoryId)`.
- Combined tag + category: query may be tag-based first, then client filter by category (existing behavior); cache key must reflect the combination you actually fetch.

### Proposed query contract

| Item | Suggestion |
|------|------------|
| **Query key shape** | `['recipes', { tagIds: string[] | undefined, categoryId: string | undefined }]` with **`tagIds` sorted and deduped** so the same logical filter always hashes to the same key. |
| **Query function** | Wrap existing `fetchRecipes(tagIds, categoryId)` — no Firestore change required initially. |
| **`staleTime`** | Often **shorter** than reference data (recipes change more often), e.g. 1–3 minutes, or `0` with aggressive **`invalidateQueries`** after writes; tune after Phase 3 ships. |

### Consumers today (all use `src/hooks/useRecipes.ts`)

- `src/pages/HomePage.tsx` — `useRecipes()` (no filters).
- `src/pages/RecipeListPage.tsx` — `useRecipes(tagFilter, selectedCategory)`.
- `src/pages/SuggestionsPage.tsx` — `useRecipes()` (no filters).

Keep the **public hook API** (`recipes`, `loading`, `error`, `refresh`) where possible so pages change minimally.

### Invalidation / updates when recipes change

Any operation that changes recipe documents read by list queries should update or invalidate relevant keys:

- `createRecipe`, `updateRecipe`, `deleteRecipe`, `incrementCookedCount` in `useRecipeMutations` / `firestore.ts`.
- **Tag delete** and **category delete** in `firestore.ts` (batch updates on many recipes) — safest approach is **`queryClient.invalidateQueries({ queryKey: ['recipes'] })`** (prefix) so all filtered variants refetch, unless you implement precise `setQueryData` merging.

### Optional Phase 3b — Single recipe `useRecipe(id)`

Not required for Phase 3 list caching, but a natural follow-up:

| Item | Suggestion |
|------|------------|
| **Query key** | `['recipe', id]` where `id` is the Firestore document id. |
| **Query function** | `fetchRecipe(id)` from `firestore.ts`. |
| **Consumers** | `RecipeDetailPage`, `RecipeEditorPage` (`useRecipe` today). |

Enable/disable `enabled: !!id` so the query does not run when `id` is undefined (create flow).

### Acceptance checklist (when Phase 3 is done)

- [ ] `queryKeys` / helpers define stable `['recipes', …]` keys.
- [ ] `useRecipes` uses `useQuery`; filter changes update the key and fetch the correct variant.
- [ ] Mutations that affect lists invalidate or patch recipe queries as agreed.
- [ ] Document final `staleTime` and invalidation rules in [Architecture](./architecture.md#server-state-cache-tanstack-query--phase-1).
- [ ] If 3b is implemented, document `['recipe', id]` alongside list keys.

---

## Suggested order of implementation

1. **Phase 2** (pantry) — bounded surface area, four obvious call sites, clear win.
2. **Phase 3** (recipe lists) — more keys and invalidation edges (tags/categories/delete).
3. **Phase 3b** (`useRecipe`) — optional polish for detail/editor.

After each phase, update **`src/lib/queryKeys.ts`**, **`docs/architecture.md`**, **`docs/data-and-firebase.md`**, and this roadmap (check off boxes, move “planned” to “done”).
