# Player account UI candidates

## Integrated entry gate

`src/components/player/PlayerAccountGate.jsx` is the mountable entry shell. It accepts `authController`, `saveCoordinator`, `onSelectedSave(source)`, optional explicit `navigate(url)`, readiness booleans, language and `initiallyOpen` (default false). It subscribes with `useSyncExternalStore`; snapshots must be referentially stable between changes. It presents a compact account/save disclosure and the controlled panels when expanded. Parent still owns dependency lifetimes and App/runtime mounting.

The coordinator must expose `getSnapshot`, `subscribe`, `bootstrap`, `selectSlot(slotId)`, `createSlot()`, `continueGuest()`, and `logout()`. Every action resolves `{ ok: true }` or `{ ok: false, error: { code, message } }`. Snapshot: `{ status: 'guest' | 'loading' | 'adopting' | 'ready' | 'error' | 'switching', slots: [], selectedSlotId, error, source: null | { key, service, ownerId?, slotId? } }`. Coordinator owns auth bootstrap/subscription/reconciliation and protected automatic guest adoption. Gate calls coordinator.bootstrap when dependencies mount/change, not auth.bootstrap separately.

Gate reports source changes including `null` to `onSelectedSave`; parent must unmount/revoke previous entry while source is null, not retain the prior service. `logout()` must close/revoke active runtime and clear source before returning `{ ok: true }`; only then does the gate invoke auth.logout. Failed or uncertain preparation cannot trigger auth logout. If auth logout fails, surface the error and retain coordinator's safely closed state until an explicit recovery action.

`playerAccountGateActions.mjs` catches exceptions, handles controller-returned validation/readiness errors, fences repeated/stale actions, and dispatches only through injected dependencies. Guest continuation can supersede an in-flight auth UI action, dismissing old OAuth navigation while preserving real auth events. No default window navigation exists. Both successful OAuth result and explicit injected navigator are required. Dispose only this action fence on unmount; do not dispose shared controllers.

Auth snapshot `sessionEpoch` is a monotonic local lifecycle fence. Identity transitions and a `SIGNED_IN` event with a changed private JWT `session_id` increment it; same-identity token refresh/update do not. Logout followed by login by the same user increments via the signed-out transition. JWT claims used for this comparison are unverified and never authorization, and neither tokens nor session IDs are exposed in snapshots. If no usable session ID exists, identity transitions still fence the session; no session uniqueness is fabricated.

`sessionOrigin` is `restored`, `login`, or `signed_out`. Session hydration through bootstrap or INITIAL_SESSION is restored, not proof of a new user login. Successful OTP verification and a new-session SIGNED_IN event mark login; duplicate same-session SIGNED_IN and same-identity refresh/update preserve origin. More recent SDK events supersede stale bootstrap results. Coordinator must only consider actual login origin eligible for its explicit single-device takeover flow. A callback session with lost login-event evidence remains restored and needs explicit safe resume rather than guessed takeover. Origin/epoch remain UI lifecycle facts, never authentication or authorization proofs.

## Dedicated client factory

`src/lib/playerSupabase.js` exports `createPlayerSupabase({ env, currentOrigin, createClientImpl? })`. Importing it creates no client. It returns `{ enabled: false, client: null, error }` unless all settings are ready, or `{ enabled: true, client, verifiedOrigin, callbackUrl, otpReady: true, error: null }` when construction succeeds. Tests inject a fake factory; they do not connect to Supabase.

Required configuration (none written by this change): `VITE_PLAYER_ACCOUNTS_ENABLED='true'`, `VITE_PLAYER_OTP_CONFIGURED='true'`, `VITE_PLAYER_SUPABASE_URL`, `VITE_PLAYER_SUPABASE_PUBLISHABLE_KEY`, `VITE_PLAYER_AUTH_ORIGIN`, `VITE_PLAYER_AUTH_CALLBACK_URL`. Flags are exact strings. Key must be a frontend `sb_publishable_` key; legacy JWT keys and secret/service-role credentials are rejected. The browser's caller-supplied current origin must exactly match the configured origin, and callback validation must pass. The factory never falls back to admin configuration.

The actual `playerAccountRuntime.js` composition factory additionally requires exact `VITE_PLAYER_CLOUD_CONFIGURED='true'` before touching browser storage or constructing any client. `main.jsx` mounts PlayerAccountApp only when this explicit composition succeeds and never on the admin route. Disabled/unready deployments retain App's guest entry path (with its claim-aware default save service). No environment variables were changed to enable this candidate.

It uses PKCE and the distinct `newtone-player-auth-v1` storage key, with SDK persistence/refresh but automatic URL session detection disabled. `playerOAuthFlow.mjs` records a same-tab, callback-bound ten-minute intent only when an explicit Google initiation succeeds. On the exact callback route with a single code parameter, bootstrap calls SDK `exchangeCodeForSession` only with matching unexpired intent. The SDK validates the PKCE exchange; successful returned nonanonymous session is required before login origin, intent consumption and history replacement that removes the callback code. In-flight/failed exchanges are cached to avoid duplicate one-time-code use during repeated bootstraps. Without intent or successful exchange the restored session cannot be guessed into a takeover. The flow is injected through `oauthFlow` on the auth controller; no callback code/token is published or logged. Google readiness additionally requires a usable flow and explicit navigation adapter.

`PlayerAccountApp` directly subscribes to the coordinator, so switching/error/null source does not retain a stale game until a child effect runs. Each valid source mounts `<App key={source.key} saveService={source.service}>`; App changes are limited to that optional initial service injection. The host always shows account access and a bounded prompt if no source is ready. Offline suspends only an active account source; hidden/pagehide attempt a best-effort checkpoint. These lifecycle hooks do not mutate authentication and do not promise unload durability. The runtime's explicit dispose stops coordinator/auth listeners and SDK refresh without signout or credential deletion; React unmount does not own the runtime.

The isolated browser fixture in `e2e/playerAccountHost.spec.ts` verified Chinese rendering, guest continuation, keyboard disclosure, slot selection/source replacement and 390px viewport overflow using test-only adapters, with no live Auth or SMTP. Screenshots were inspected at desktop/tablet and mobile widths. This does not validate actual email delivery, Google provider configuration, SQL deployment, or live multi-device behavior.

Gate callback behavior is tested without a DOM through the same action helper used by the mounted shell, including logout ordering, concurrent clicks, stale OAuth, guest continuation, and errors. SSR tests cover shell rendering; browser interaction/visual QA still belongs to integrated App verification.

These components are isolated presentation candidates, not mounted in App. They create no client, session, storage, requests, timers, or subscriptions. They use the existing reader ink/paper/border theme tokens, bilingual Chinese/English text, labelled inputs, live status/error messages and 44px minimum controls. No dependency was added.

## PlayerAuthPanel

Import `src/components/player/PlayerAuthPanel.jsx`. Supply:

- `snapshot`: the player auth controller's current snapshot; default is unknown, not a fabricated signed-out session.
- `language`: `zh` (default) or `en`.
- `otpReady`: exact `true` only after the OTP delivery release gates are verified. `googleReady` is separately opt-in. Both default off.
- Controlled `emailInput`, `codeInput`, `onEmailChange(value)`, `onCodeChange(value)`. Code stays a string to preserve leading zeroes. Clear the code on successful submission, account/context changes, and changing email. No value is persisted by this view.
- `onRequestOtp(email)`, `onVerifyOtp(email, code)`, `onGoogle()`, `onLogout()`, `onCancel()` and `onGuest()`.
- Optional parent `pending` and safe `{ message }` `error`, in addition to snapshot pending/error.

The parent orchestrator subscribes to the controller, bootstraps it outside render, and routes callbacks to its methods. It must consume returned failures (including validation failures) into `error`, catch rejected integration callbacks, and expose pending state. The controller provides the synchronous request lock, so rapid repeated clicks must route through it, never directly to the SDK. The view does not own or dispose the controller.

`onCancel` means change email: call controller.cancel and clear the code. The view disables changing email while a request is pending. Guest play remains available even while auth is unavailable or pending. `onGuest` must dismiss the auth flow and keep guest entry available; cancelling a pending auth result cannot undo an email or real session event. Handle later real authentication via the orchestrator. Google returns a URL from the controller; the parent must only navigate on a successful, still-current operation.

Authenticated state requires a supplied real user ID. Unknown state cannot submit. The UI does not treat its snapshot as authorization and creates no fake session to unlock controls.

## PlayerSaveSlots

Import `src/components/player/PlayerSaveSlots.jsx`. Supply:

- `status`: `signed_out` (default), `loading`, `adopting`, `ready`, or `error`.
- `slots`: authenticated owner's catalogue entries `{ slotId, label?, summary? }`; optional labels/summaries must be real supplied display data, not invented progress.
- `selectedSlotId`, `pending`, safe `error`, `language`, `onSelect(slotId)`, `onCreate()`, and `onRetry()`.

Parent operations must retain the account-bound guard and creation policy, synchronously guard duplicate actions, and disable stale selections during an operation. A selected row is only selection state, not proof a runtime has entered that slot. There is one create control plus enough empty placeholders to show three positions. At the current limit, creation disappears. Unexpected pre-existing overflow entries remain visible and are never deleted. Invalid/duplicate catalogue IDs fail closed; a loading or failed catalogue is never shown as empty.

During registration's protected automatic guest-save adoption, supply `status: 'adopting'` and expose no slot actions until adoption and catalogue verification complete. There is deliberately no bind button: registration automatically retains the current save through the parent's distinct idempotent transaction. Neither view performs adoption, replacement, deletion, or backup cleanup.

## Verification scope

`tests/playerAccountPanels.test.mjs` uses real React server rendering to check auth readiness, guest availability, OTP/pending/errors, selected slots, capacity, preservation, accessibility attributes, and both languages. It is not a browser interaction or visual QA claim. Run integrated browser checks after App wiring; no live Auth or network calls are used by these tests.
