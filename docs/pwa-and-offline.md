# PWA and offline

Progressive Web App behavior comes from **vite-plugin-pwa** in `vite.config.ts`.

## Registration

- `registerType: "autoUpdate"` — when a new service worker is published, the app updates on the next visit without prompting by default (plugin behavior).

## Web app manifest

Configured inline in the plugin: app name, short name, description, `start_url: "/"`, theme and background colors, `display: "standalone"`, and PNG icons (192, 512, maskable). Static assets listed in `includeAssets` include `icons/favicon.svg` and `icons/apple-touch-icon.png`.

## Caching and offline

The plugin generates a **Workbox-based** service worker that precaches the production build assets so the shell can load offline after the first successful visit. **Firestore and Storage still require network access** unless you add explicit offline persistence or other strategies; expect recipe data not to be available when fully offline unless the client has cached responses.

If you change PWA options (caching strategies, precache manifest, manifest fields), update this file and verify installability in Chrome’s Application tab.
