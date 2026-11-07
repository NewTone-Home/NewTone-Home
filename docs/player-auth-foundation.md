# Player authentication foundation

This is an isolated, dependency-injected controller. It is not connected to App, admin authentication, save adoption, or a live Supabase project. No credentials or provider settings are supplied by this change.

## Contract

Create `createPlayerAuthController({ auth, verifiedOrigin, callbackUrl, otpEmailConfigured })` with a dedicated player client's `auth` adapter. Supported methods are `bootstrap`, `refresh`, `requestEmailOtp(email)`, `verifyEmailOtp(email, code)`, `beginGoogleOAuth`, `logout`, `cancel`, and `dispose`. Construction does no SDK work. Bootstrap explicitly reads the current session and installs one auth subscription. Other operations also ensure that subscription exists.

`getSnapshot` and `subscribe` support React's `useSyncExternalStore`. The stable snapshot has `status` (`unknown`, `signed_out`, `authenticated`), minimal `user` (`id`, `email`), `pending`, requested `email`, and safe `error`. It never includes tokens or raw server error messages. Operations resolve `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Validation errors are returned to the caller; SDK errors additionally appear in the snapshot. Google initiation returns a URL but never navigates. Callers must navigate only after a successful current result, using the trusted injected SDK's URL.

Only one SDK operation can be in flight; another returns `busy`, including logout during verification. Disable conflicting UI controls while `pending` is non-null. `cancel` dismisses the result, not the network request: it cannot unsend email, undo login, or revoke a session. The lock remains until the actual request settles. Real SDK session events remain authoritative even after cancel. After an operation settles the user can explicitly log out. `dispose` removes subscriptions and ignores later results; it does not sign out or dispose a shared SDK client. A disposed controller cannot be reused.

SDK auth events supersede older session reads. An empty `INITIAL_SESSION` is initialization, not a new sign-out intent, so it preserves the pending code-entry email. Same-identity refresh/update events also preserve that email. Real sign-in/sign-out, account changes, cancellation, and successful verification clear it. Real account/session changes still invalidate older OTP request results. Cancellation or disposal by a subscriber before SDK dispatch prevents that dispatch; disposal during synchronous initial-event registration also cleans up the returned subscription. Auth callbacks do not call back into Supabase. Consumers must not synchronously initiate SDK work from a subscriber called during an SDK auth event; schedule subsequent work outside that callback. Session state is for UI only: a local email, user ID, or snapshot is **not** authorization. Cloud save operations still require a trusted authenticated session and server-side ownership enforcement through RLS.

This auth controller does not adopt guest saves itself. The chosen registration experience must automatically retain the current save without an extra binding click. A future orchestrator must perform that automatic, idempotent adoption as a distinct protected transaction, preserving the account-bound storage guards and preventing duplicate adoption or overwriting unrelated account saves. A UI authentication event alone must not bypass those transaction checks.

## Release gates (not performed here)

1. Verify a player-specific client/config and intended player sign-up policy. This controller requests `shouldCreateUser: true`; it never alters the admin flow. Keep service-role keys out of frontend code and keep player/admin storage scopes separate.
2. Verify the email template actually includes `{{ .Token }}` and delivers a code, not a magic link. Only then pass the exact boolean `otpEmailConfigured: true`; default is blocked. Confirm configured code length (accepted here: 6–10 decimal digits), expiry, rate limits, SMTP delivery, and abuse protection. Do not enable this flag as a substitute for operational verification.
3. Verify deployment-owned `verifiedOrigin` and exact `callbackUrl` against Supabase's redirect allowlist. They must be absolute, same-origin HTTPS (HTTP loopback allowed for development), without callback query, fragment, or credentials. Do not derive either from user-controlled redirect input. Enable/configure Google separately before exposing its control. Complete OAuth callback/PKCE handling through the dedicated client integration, not this controller.
4. Verify auth/session persistence, account changes and logout against the save-adoption boundary before App wiring. Logout is explicitly `scope: 'local'`; it does not sign out all devices. An existing JWT can remain valid until expiry even after sign-out.
5. Run authorized staging end-to-end login/delivery tests only after configuration and consent. The automated tests here use fake adapters only and send no emails or OAuth traffic.

## Verified references (2026-11-07)

- [Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless): `signInWithOtp` shares implementation with magic links; the email template determines which is delivered. Verification uses `{ email, token, type: 'email' }`.
- [JavaScript OAuth](https://supabase.com/docs/reference/javascript/auth-signinwithoauth), [auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), and [sign-out](https://supabase.com/docs/reference/javascript/auth-signout). `skipBrowserRedirect` was also checked in the installed pinned SDK's types.
- [Changelog](https://supabase.com/changelog): reviewed current breaking-change entries. The June 2026 email-template restriction means new Free projects on default SMTP may require custom SMTP before customizing the OTP template. No configuration change is made here.

Uses the existing pinned `@supabase/supabase-js` 2.112.0 contract without adding or updating dependencies.
