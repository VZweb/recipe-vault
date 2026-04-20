# Operations

## Environment variables

Copy `.env.example` to `.env` and set:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Vite exposes only variables prefixed with `VITE_` to the client bundle.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b` then production Vite build (`NODE_OPTIONS='--max-old-space-size=4096'` for the Node heap during build) |
| `npm run preview` | Serve the `dist` output locally |
| `npm run lint` | ESLint |
| `npm run deploy` | `npm run build` then `firebase deploy` |

## Firebase Hosting

`firebase.json` sets `hosting.public` to `dist` and SPA rewrites: all paths serve `index.html`. Firestore rules file: `firestore.rules`; Storage rules: `storage.rules`; indexes: `firestore.indexes.json`.

Deploy requires the Firebase CLI, project selection, and appropriate IAM on the Firebase project.

## Adding features that affect ops

Document new env vars in `.env.example` and this file. Document new Firebase products (e.g. Auth, Functions) here and in [Architecture](./architecture.md) / [Security](./security.md) as applicable.
