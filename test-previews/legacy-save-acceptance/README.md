# Legacy save acceptance preview

This branch exists only for the isolated acceptance preview. It is based on deployed main `a5860fc202e58a450d6d7ef6a1b665b6d6d1ac43`; it does not alter `main`, `staging`, production domains, or actual player saves.

## Fixtures and checks

Use the panel over the game to import one synthetic version-1 localStorage fixture. The import writes only the `newtone-*` keys on the preview hostname, then reloads the normal app entry point so the current startup/save loader restores it.

- `tests/fixtures/legacy-commercial-street.json`: expected scene `commercial-street`, non-default position `(38, 53)`; completed interaction tutorial, explored object, street narrative and milk-tea unlock.
- `tests/fixtures/legacy-commercial-cafe.json`: expected scene `commercial-cafe`, non-default position `(20, 70)`; complete story cursor 14, coffee delivered, completed narrative phase and Lao Zhou departed.

The panel reports the save snapshot after the reload. Compare the visible world scene with its expected location. Use “Refresh evidence” after moving to update the snapshot. “Clear preview save and restart” removes only `newtone-*` localStorage keys on the preview origin.

## Isolation

On this branch alone, `scripts/vercel-build.mjs` sets both Supabase Vite values to empty and enables the fixture panel. `vercel.json` applies a Content Security Policy with `connect-src 'none'` and no external scripts or images. The app's Supabase client is therefore unconfigured, analytics return without recording, and browser fetch/XHR/WebSocket connections are blocked.

No credentials, production URLs, live storage exports, or database rows are included.
