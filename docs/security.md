# Security

## Current posture

The app uses **Firebase Authentication** (email/password and Google). Signed-in users access only their own **vault** data: `recipes`, `tags`, `categories`, and `pantry` documents include an **`ownerId`** field (Firebase Auth `uid`) that must match `request.auth.uid` in Firestore rules.

### Ingredients catalog

Documents in **`ingredients`** are either:

- **Shared catalog:** `catalog: true` (typically no `ownerId`) — readable by any signed-in user. **Create / update / delete** from the client is allowed only for accounts that have the Auth **custom claim** `catalogAdmin: true` (set with `node scripts/set-catalog-admin-claim.mjs --uid=YOUR_AUTH_UID` using the Admin SDK service account). Everyone else sees catalog rows as read-only in the app; Firestore rules enforce the same.
- **User-owned:** `ownerId` equals the user’s `uid` and `catalog` is false — that user may create, update, or delete their own rows.

From the repository root, run `node scripts/backfill-ingredients-catalog.mjs` once on existing data so legacy catalog rows get `catalog: true` before relying on these rules.

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
