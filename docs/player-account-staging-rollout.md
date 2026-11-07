# Player account staging rollout - 2026-11-07

This record supersedes historical candidate/not-executed comments in the reviewed SQL and earlier planning documents. Applied SQL is unchanged.

## Applied database migrations

- `20261107103235_player_account_slots_and_recovery`: player-account tables, three-slot quota, session fencing, CAS/receipts/backups, player RLS and registration eligibility trigger with restricted internal roles.
- `20261107104024_player_account_private_auth_context`: narrow private Auth context reader for hosted Auth schema/RLS access. Player dispatch retains its restricted executor owner and independent player-table RLS.

Local migration filenames match actual remote migration versions. Production was not changed. Do not reapply the initial creation SQL.

## Verified on staging

Both migrations succeeded. The authenticated-role RPC smoke without a JWT now rejects with the expected `AUTH_REQUIRED`. Postchecks confirmed temporary privilege removal, helper ACLs, internal role memberships/RLS and unchanged existing administrator/profile/world-state fingerprints. Private account details and data fingerprints are not reproduced here.

Read-only postchecks show one existing Auth user, no sessions, one profile and one world-state row; all six new player tables remain empty.

## Frontend release candidate

The user selected email-link sign-in and three slots. Numeric OTP support is retained but disabled for this release. Link mode disables the Google entry until a separately reviewed combined callback flow exists.

The dedicated player client uses PKCE, a same-origin cross-tab intent, a 10-minute intent lifetime and single-consumer Web Lock. A link must be opened in the browser that requested it. No browser/device mismatch fallback guesses a session. Account saves retain the existing ownership and recovery guards.

Only the `newtone-staging` Vercel project is a release target. Direct file deployment uses `NEWTONE_DEPLOYMENT_ENV=staging`; `NEWTONE_BUILD_SHA` provides a validated source-commit fallback when Git metadata is absent. No Git push is needed and no production project should be changed.

Keep `VITE_PLAYER_EMAIL_LINK_CONFIGURED=false` until the exact redirect is verified. The intended origin is `https://newtone-staging.vercel.app` and callback is `https://newtone-staging.vercel.app/auth/player/callback`.

The currently shown Supabase default email is not NewTone-branded. The dashboard requires custom SMTP before editing its subject/body. Sender/domain setup, credentials and actual delivery are separate unfinished work. The app states this limitation rather than claiming branded mail is already active.

## Verification limits

- Frontend publication is still pending at this source snapshot.
- Real email delivery/login and two-user/multiple-device tests are unfinished.
- Newest link-mode/build-selector test sources have not been executed.
- No-JWT rejection does not prove authenticated isolation, save recovery, concurrent CAS, or full end-to-end behavior.

The first synthetic SQL attempt stopped at read-only preflight with SQLSTATE 42702, before inserting fixtures. The corrected file now consistently prefixes PL/pgSQL variables with `v_` and was reviewed again, but was not executed. Synthetic Auth/session mutations require separate confirmed execution scope. Do not report this candidate contract test as passed.

Keep server and browser recovery data. If disabling the release, use the reviewed non-destructive disable procedure and a claim-aware compatible frontend. Never roll back to a pre-account raw-localStorage frontend after a guest save has been claimed.
