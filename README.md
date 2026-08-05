# NewTone first release

Landing and Reader are the only public product surfaces. Center is intentionally excluded. Public visitors require no account and read only the current published Reader content from Supabase. Browser reading progress is local-only.

The database intentionally starts with no published body content. The public shell therefore reports that the new body is not yet published; no legacy manuscript or placeholder prose is bundled. Formal production launch is blocked until the owner authors and publishes the approved new body through `/admin`.

## Local verification

```bash
npm ci
npm test
npm run lint
npm run build
npm run preview
```

Copy `.env.example` to `.env.local` and set only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never put a Supabase service-role key in a `VITE_` variable. See `docs/OWNER_ADMIN_AND_ANALYTICS.md` for the owner allow-list, Magic Link redirect, content publication, analytics query, privacy, and retention procedure.

## Vercel

The framework is Vite, build command is `npm run build`, and output directory is `dist`. Set the two public Supabase variables for both Preview and Production. Production Branch must be `main`. `/admin` is an unlinked SPA route protected by Supabase Auth plus database owner authorization.

GitHub Pages configuration, if retained in repository history, is preview-only and is not the formal production channel.

## Reader copy deterrence

The published Reader disables text selection, copy/cut, drag, the Reader context menu, and the ordinary select/copy keyboard shortcuts. The owner workbench remains editable. This is a deterrent for casual copying; browser developer tools, screenshots, OCR, and determined extraction cannot be made impossible for anonymously readable web content.
