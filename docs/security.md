# Security

## Current posture (MVP)

`firestore.rules` and `storage.rules` allow **read and write for all clients** (`allow read, write: if true`). Comments in those files note: single-user MVP with **no Firebase Auth**.

Anyone with your Firebase config can read or modify data in that project. Treat `.env` as secret-adjacent (API keys are restricted in Google Cloud Console, but data rules are still wide open).

## Hardening path

When you add Firebase Authentication:

1. Replace open rules with user-scoped rules (for example `request.auth != null` and document paths or custom claims that identify the owner).
2. Update `src/lib/firebase.ts` to initialize Auth and gate writes in the UI as needed.
3. Update [Architecture](./architecture.md) and [Data and Firebase](./data-and-firebase.md) to describe the auth model.

Keep this file aligned with the actual rule files; the rules files are the source of truth for enforcement.
