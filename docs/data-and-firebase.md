# Data and Firebase

The web client uses the Firebase JS SDK. There is no custom REST API: reads and writes go directly to Firestore and Storage from the browser.

## Initialization

`src/lib/firebase.ts` calls `initializeApp` with values from `import.meta.env` (`VITE_FIREBASE_*`). It exports:

- `db` — Firestore instance
- `storage` — Firebase Storage instance

There is **no Firebase Authentication** in the app today; security rules are open for MVP (see [Security](./security.md)).

## Firestore collections

Collection names and mapping logic live in `src/lib/firestore.ts`.

| Collection | Purpose | Ordering / queries used |
|------------|---------|-------------------------|
| `recipes` | Recipe documents | Default list: `orderBy("createdAt", "desc")`. Optional filters: `array-contains-any` on `tags` (max 10 tag IDs per Firestore constraint), `where("categoryId", "==", id)`. Client-side sort after fetch when combining filters. |
| `tags` | Tag metadata | `orderBy("name")` |
| `categories` | Recipe categories | `orderBy("name")` |
| `pantry` | Pantry items | `orderBy("name")`, then client sort by category and name |
| `ingredients` | Master ingredient catalog | `orderBy("name")` |

### Recipe documents

Recipes store arrays of ingredient lines and step strings, optional `categoryId`, `tags` (array of tag document IDs), `imageUrls`, timestamps (`createdAt`, `updatedAt`), and `cookedCount`. `docToRecipe` normalizes missing fields when reading.

Deleting a recipe removes linked Storage objects best-effort (`deleteRecipe` + `deleteRecipeImage`).

### Tags and categories

- **Delete tag**: batches removal of that tag id from every recipe’s `tags` array, then deletes the tag document.
- **Delete category**: sets `categoryId` to `null` on affected recipes, then deletes the category.

### Pantry

Pantry items reference `masterIngredientId` (string). Deleting a pantry item removes its `imageUrl` file from Storage when present (dynamic import of `deletePantryImage`).

### Master ingredients

Stored in the `ingredients` collection (not named `masterIngredients` in Firestore). Used for autocomplete, Greek names, aliases, and matching in search and suggestions.

## TypeScript types

Canonical shapes are in `src/types/` (`recipe.ts`, `tag.ts`, `category.ts`, `pantry.ts`, `ingredient.ts`). When you change Firestore fields, update both the mapper in `firestore.ts` and the corresponding types.

## Firebase Storage paths

Implemented in `src/lib/storage.ts`:

- Recipe images: `recipes/{recipeId}/{timestamp-random}.{ext}`
- Pantry images: `pantry/{itemId}/{timestamp-random}.{ext}`

Download URLs are stored on documents (`imageUrls` on recipes, `imageUrl` on pantry items).

## Indexes

`firestore.indexes.json` is currently empty. If you add composite queries that require indexes, deploy them with `firebase deploy` (or the Firebase console) and document new query combinations here.
