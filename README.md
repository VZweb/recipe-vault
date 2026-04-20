# Recipe Vault

A personal recipe manager PWA powered by Firebase. Store recipes, organize with tags, search your collection, manage your pantry, and discover what you can cook with what you have.

## Tech Stack

- **React 18** + TypeScript + Vite
- **TailwindCSS** for styling
- **Firebase** (Firestore, Storage, Hosting)
- **Fuse.js** for client-side search
- **Lucide** for icons
- **vite-plugin-pwa** for offline support

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore and Storage enabled

### Setup

1. Clone the repo and install dependencies:

```bash
cd recipe-vault
npm install
```

2. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com):
   - Enable **Cloud Firestore** (start in test mode)
   - Enable **Firebase Storage** (start in test mode)
   - Register a web app and copy the config

3. Create a `.env` file from the example:

```bash
cp .env.example .env
```

4. Fill in your Firebase config values in `.env`.

5. Start the dev server:

```bash
npm run dev
```

### Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting  # select your project, use "dist" as public dir
npm run deploy
```

## Project Structure

```
src/
  components/     UI components (buttons, inputs, cards, layout)
  pages/          Route pages (Home, Recipes, Pantry, etc.)
  hooks/          React hooks for data fetching
  lib/            Firebase init, Firestore helpers, search, suggestions
  types/          TypeScript type definitions
docs/             In-depth documentation (architecture, data model, security)
```

## Documentation

Detailed docs live under [`docs/`](./docs/README.md):

- [Architecture](./docs/architecture.md) — routing, layout, how layers connect
- [Data and Firebase](./docs/data-and-firebase.md) — collections, Storage paths, indexes
- [Domain logic](./docs/domain-logic.md) — search, suggestions, parsing, normalization
- [PWA and offline](./docs/pwa-and-offline.md) — manifest and service worker
- [Operations](./docs/operations.md) — env vars, scripts, deploy
- [Security](./docs/security.md) — Firestore and Storage rules, hardening notes

## Features

- Recipe CRUD with ingredients, steps, and photos
- Tag-based organization and filtering
- Full-text search across recipes
- Pantry management (track what you have at home)
- "What can I cook?" suggestions based on your pantry
- PWA with offline support
- Responsive design (mobile + desktop)
