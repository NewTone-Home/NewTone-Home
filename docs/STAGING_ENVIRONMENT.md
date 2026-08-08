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

Every push to `staging` should create or update a Vercel Preview deployment. The production branch must remain `main`.

Configure these variables in Vercel for the `staging` Preview branch, using test-environment values rather than production values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Never put Supabase secret keys or `service_role` keys in this repository or in browser-exposed `VITE_*` variables.

## Supabase isolation

The staging Vercel deployment should connect to a separate Supabase development branch or separate test project. It must not write test events, accounts, analytics, or content into the production database.

Production and staging should therefore use different Supabase URLs and publishable keys.

## Release flow

1. Make changes in the `staging` worktree.
2. Run local tests and build checks.
3. Push `staging` and test the Vercel Preview URL.
4. Verify database writes, authentication, analytics, callbacks, and endpoint behavior against the test Supabase environment.
5. Merge verified changes from `staging` into `main` through a pull request.
