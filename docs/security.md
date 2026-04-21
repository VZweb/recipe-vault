# Security

## Current posture

The app uses **Firebase Authentication** (email/password and Google). Signed-in users read and write only under their own document tree: **`users/{uid}`** and subcollections **`recipes`**, **`pantry`**, **`tags`**, **`categories`**, and **`customIngredients`**. Authorization is path-based (`request.auth.uid == userId`); optional `ownerId` fields on migrated documents are not used for access control.

The **`users/{uid}`** document holds account metadata (for example `vaultDefaultsApplied` after starter tags/categories are seeded). Rules allow read/write only when `request.auth.uid == userId`.

### Ingredient catalog

Top-level **`ingredientCatalog`** holds shared master ingredients. Any signed-in user may **read** catalog documents. **Create, update, and delete** are allowed only for accounts with the Auth custom claim **`catalogAdmin: true`** (set with `node scripts/set-catalog-admin-claim.mjs --uid=YOUR_AUTH_UID` using the Admin SDK service account). The app treats catalog rows as read-only for everyone else; Firestore rules enforce the same.

User-created master ingredients live in **`users/{uid}/customIngredients`** and are readable/writable only by that user.

After granting `catalogAdmin`, that user should **sign out and back in** (or otherwise refresh the ID token) so the claim appears in `getIdTokenResult()` and in rule evaluation.

### Storage

Paths are user-scoped:

- Recipe images: `recipes/{uid}/files/...`
- Pantry images: `pantry/{uid}/{itemId}/...`

Rules allow read/write only when `request.auth.uid` matches the path segment.

## Operations notes

- Treat `.env` as secret-adjacent; Firebase web API keys are restricted in Google Cloud Console where possible.
- Service account keys (for scripts) must never ship to the browser or public repos.

Keep this file aligned with [`firestore.rules`](../firestore.rules) and [`storage.rules`](../storage.rules); those files are the source of truth for enforcement.
