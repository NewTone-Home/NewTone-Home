# NewTone staging environment

This branch is the long-lived pre-production environment for NewTone.

## Branch roles

- `main`: production code and production Vercel deployment.
- `staging`: online testing code and Vercel Preview deployment.
- Feature or fix branches should be tested before they are merged into `main`.

Do not make experimental changes directly on `main`.

## Local worktree

From the existing NewTone repository on Windows:

```powershell
git fetch origin

git branch --track staging origin/staging

git worktree add ..\NewTone-Staging staging
```

If a local `staging` branch already exists, skip the `git branch --track` command and run only:

```powershell
git worktree add ..\NewTone-Staging staging
```

The result should be two separate working folders backed by the same repository:

- the existing production worktree on `main`
- `NewTone-Staging` on `staging`

## Local Supabase configuration

Inside `NewTone-Staging`, create an ignored `.env.local` file using the public URL and publishable key from the separate `NewTone-Staging` Supabase project:

```text
VITE_SUPABASE_URL=https://ksrvlkcpaiowhcvzimkc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<NewTone-Staging publishable key>
```

Never use a Supabase secret key or `service_role` key in a browser-exposed `VITE_*` variable.

## Local verification

Run these commands inside `NewTone-Staging`:

```powershell
npm ci
npm run test
npm run build
npm run preview
```

Use `npm run dev` for normal development and `npm run preview` to verify the built application locally.

## Vercel Preview

Every push to `staging` creates or updates the branch Preview deployment. The production branch remains `main`.

Vercel runs `scripts/vercel-build.mjs`. When `VERCEL_GIT_COMMIT_REF` is exactly `staging`, that build script injects the public URL and publishable key for the isolated `NewTone-Staging` Supabase project before running the normal application build. Every other branch preserves the Supabase values configured in Vercel.

This branch check prevents the production build on `main` from being redirected to the test database even if the build script is later merged.

## Supabase isolation

The staging Vercel deployment connects to a separate Supabase test project. It must not write test events, accounts, analytics, drafts, publications, or content into the production database.

Production and staging therefore use different Supabase URLs and publishable keys. The staging database contains the same schema and RLS structure but starts without production user data.

## Release flow

1. Make changes in the `staging` worktree.
2. Run local tests and build checks.
3. Push `staging` and test the Vercel Preview URL.
4. Verify database writes, authentication, analytics, callbacks, and endpoint behavior against the test Supabase environment.
5. Merge verified changes from `staging` into `main` through a pull request.
