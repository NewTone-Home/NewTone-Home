# NewTone first-release include/exclude manifest

This branch is assembled from `origin/main` in a clean worktree. It intentionally ports only the approved Landing, Reader, owner administration, Supabase, analytics, test, and deployment files from the unrelated local integration history.

## Included

- Public Landing and Reader routes, responsive styles, transitions, language/theme/reading controls, and required Landing assets.
- An intentionally empty Supabase content state. The browser runtime reads only an owner-published Supabase row; no legacy manuscript is bundled or seeded.
- A separate `/admin` owner surface containing only the content/pagination workbench required to edit drafts, preview pagination, and publish a new version.
- Supabase Auth for the admin surface and database-enforced owner authorization through an explicit owner allow-list.
- Supabase migrations for published content, private drafts, owner authorization, anonymous analytics, RLS, grants, and private aggregate analytics views.
- Anonymous, best-effort first-party product analytics with pseudonymous local identifiers and no raw manuscript text or unnecessary personal fields.
- Focused unit/integration tests, lint/typecheck/build configuration, Vercel SPA configuration, and deployment documentation.

## Excluded

- Center UI, routes, state transitions, Phaser/place-stage code, Center assets, and Center tests.
- Theme Lab, Place Stage Lab, hidden local-password developer gate, and unrelated diagnostic/experimental surfaces.
- Remote reading-progress sync, profiles, feedback, or any claim of cross-device public-reader state. Public progress remains local to the browser.
- Unrelated analysis artifacts, generated screenshots, old asset iterations, and all other pre-existing dirty-worktree files.

## Content publication gate

No legacy manuscript is accepted as a first-release draft and no placeholder narrative is invented. Production publication and merge remain gated on the owner authoring and explicitly publishing the new body content through `/admin` (or providing the approved replacement source).

## One-time external configuration

- Set the production owner identity through the documented Supabase owner allow-list procedure; no email address is hard-coded or guessed.
- Configure Supabase Auth site/redirect URLs for the Vercel preview and production domains.
- Set only the documented public Supabase URL/publishable-key environment variables in Vercel Preview and Production.
