# Player history v2 — isolated review candidate

## Identity and scope

- Base main: `9ba382ff0fdce99b98ebd18448db794cfb77a65a`; base tree `8223d0b230b136b663f4d12ac62fb5b3b8b2240d`.
- Worktree: `C:\Users\Tony_Li\Documents\Codex\2026-10-27\task-6\newtone-player-history-v2-20261106`.
- Branch: `feat/player-history-v2-20261106`.
- Local implementation only. No push, merge, production/staging database mutation, or deployment.
- `VITE_PLAYER_HISTORY_V2=true` is required to activate collection and new owner RPC/UI. Default remains OFF until the SQL is reviewed and separately approved. Existing v1 collection continues unchanged when OFF.
- No player-save format, clock rates, inventory, orders, or cross-device synchronization changes.

## Implemented chain

| Requirement | Actual entry / implementation | Limits |
|---|---|---|
| One outer website visit | `main.jsx` existing one-time `installDwellTracking` → `installPlayerHistory` → `createWebVisit`; navigation time origin is the initial boundary | JS cannot observe activity before boot; foreground totals start when observed |
| Refresh continuation | sessionStorage visit ID, new document ID on reload/back-forward; navigation `navigate` starts a new visit, avoiding opener-cloned session identity | No cross-tab or cross-device identity claim; unavailable navigation evidence conservatively preserves continuity |
| Background and leaving | visibility is a state; pagehide is `page-leaving-signal`, `endConfirmed:false`; pageshow restores same visit | No browser API proves tab close/force kill. No event is called confirmed closure. Silence shows last known evidence only |
| Overall gameplay / actual route | existing ACK+reveal `center_entry_completed`; `endAnalyticsLocation` adds gameplay end; existing actual-position room ledger and position samples carry room IDs | Trajectory samples are not every rendered frame; door clicks do not establish entry |
| First-second no operation | separate intervals start immediately; every positive interval is retained, `durationMs > 30000` alone marks possible AFK; movement, input and visibility close intervals | Reading without input can be possible AFK; not proof of leaving. Background is excluded |
| Lower bounds after interruption | local checkpoint every existing 15-second schedule; refresh recovers last sampled interval with `partial:true`; no unsampled gap is counted | Force kill/storage exhaustion can still lose tail evidence; no invented duration |
| Interaction start/end | common `createInteractionSessions` emits start linked by interaction ID; one final raw interaction holds foreground duration and result; dialogue/choices share display session | Instant / unreliable duration stays NULL; start is evidence, not another completed interaction count |
| Dialogue last shown / confirmed | Renderer ready + accepted capacity-page advance → Page session/line/fragment guards; actual motion completion and accepted source advance → active interaction evidence; checkpoints include current evidence | Snapshot/replay callbacks excluded. Skip-typing/blocked input does not count as confirmation. No per-sentence network flood |
| Exact sentence interpretation | stable authored line ID + sentence index + page index + build SHA; owner resolves Lao Zhou/Ruoyu source only for matching build | Unknown/other build text is explicitly unresolved, never substituted with current copy. No player text collected |
| Business / story completion | existing successful persistence transition owner; shop business completion adds one shared raw fact; story completion uses existing authoritative completion transition | Failed writes do not become completion. Existing completed facts aren't replayed on hydration |
| Dual clocks | `CenterExperience` installs actual canonical `readSessionGameTimeMs` provider; real Date milliseconds determine duration | Landing/no active clock is NULL. No inferred multiplier, fabricated wall-to-game conversion, or clock input/freeze changes |
| Internal test and build | creation-time metadata; local/preview marked internal, explicit browser marker available; build wrapper injects valid `VERCEL_GIT_COMMIT_SHA` | Local unstamped build is unknown SHA; historical queues are not retagged. Marker is annotation, not authentication |
| Owner UI / trends | v2 RPC supports player UUID-prefix search, internal/external/unknown filters, bounded pagination; groups documents by visit; daily and room totals derive from full filtered raw rows, not 500-item display sample | UI browser check uses local fixtures, not real owner login. Existing owner authentication/RLS remain |

## Database proposal — NOT applied

`docs/sql/player-history-v2-review.sql` is a review draft, deliberately outside `supabase/migrations`.
It preserves old names and rows, extends allowed new metadata/event shapes, keeps owner RLS and invoker security, and adds only `owner_player_history_v2`. No UPDATE, DELETE, backfill, or anonymous read permission.

Local in-memory PostgreSQL check applies the six existing November analytics migrations and this draft over a minimal existing-table contract with synthetic owner RLS. It checks unchanged old rows, new/invalid payloads, strict >30s, no false closure, date-window baselines, player search, raw-derived totals, non-owner empty results and anon RPC denial. This is not a claim that real production schema/RLS were changed or fully re-audited.

Rollback before activation: leave flag OFF. After a separately approved activation, disable new frontend first; retain compatible constraints and history. Do not delete v2 rows to restore narrower old constraints.

## Focused verification

- `npx tsc --noEmit`.
- `npx vitest run --config vitest.analytics.config.mjs --configLoader native` (focused analytics/business tests only).
- `npx playwright test --config playwright.history.config.mjs` (390 phone + 1366 PC real Landing/game/map/refresh; owner component local fixture).
- `PGLITE_MODULE=<pinned local @electric-sql/pglite@0.3.14 dist/index.js> node scripts/verify-player-history-sql.mjs` (in-memory only).
- All browser analytics/RPC writes intercepted; fake localhost Supabase endpoint, no real database.
- Screenshots and event JSON are in Playwright test results; failure-run evidence preserved separately under task root `.player-history-v2-evidence/pre-final-browser-run`.
- Earlier transient failure: test harness used React module namespace instead of default; fixed. One dev-server run overlapped source edits and hot-reloaded; fixed-source rerun passed. Neither counted as an accepted candidate.

## Remaining review / boundaries

1. No real SQL application or release authorized. Draft needs independent review and explicit activation decision.
2. Browser close cannot be confirmed; force kill/offline only last-known / unconfirmed end. Offline queue delivery is best effort, not lossless storage.
3. Actual long-story browser progress matrix and full game were not exhaustively replayed. Common guards and isolated progress/page/clock tests cover the new contract; further representative QA can be limited to Lao Zhou skip/advance/aside and Ruoyu.
4. Cross-build sentence text remains ID evidence unless that exact source build is available. No historical reconstruction.
5. Local save retains current single-slot behavior; this work does not sync devices.

## Final focused result

- TypeScript: pass. Focused analytics: 22 files / 113 tests passed.
- Browser: 3 / 3 passed, 390×844 and 1366×768 actual entry/map/refresh plus owner component with local RPC fixtures.
- Local in-memory PostgreSQL: pass, including clipped room baseline (5000 minus 2000 before range = 3000ms), old-row preservation and access checks.
- Vite build: pass; only the existing large-chunk advisory. Build uses localhost telemetry and unknown local SHA, not a deployable production configuration.
- `git diff --check`: pass. No full-game suite, no real DB write or deployed UI verification this round.

## Review correction: strict payloads and interval overlap

- Successor to candidate `00bc9cc5daca6bf6be85e8d799ea19f2846a5401`; the same isolated branch is used.
- Any introduced field binds the payload to protocol 2. Legacy fields already used before v2 (such as `foregroundMs`, `roomId`, `endedAt`, `partial`) do not alone imply v2; legacy rows without introduced fields retain their existing constraints.
- New payloads require the complete visit/provenance envelope. IDs, bounded numeric times, nullable clocks/SHA, enums, booleans, integral indices, size and array limits are checked. Unknown root/nested keys and arbitrary JSON at scalar positions are rejected. Progress / active interaction / no-operation nesting is finite and explicitly validated.
- Pure helper functions live in `analytics_validation`, outside the public RPC schema; execute/usage grants are explicit. They read no tables. Existing owner RLS is unchanged.
- Runtime emits v2 metadata only inside an installed website visit; the first visit record explicitly carries its protocol. Admin/non-visit events retain their prior contract rather than producing incomplete v2 envelopes.
- No-operation daily totals use `[startedAt, endedAt)` intersected with `[p_from, p_to)` and each UTC day. An interval's report may arrive after the requested end; its known overlap is still counted. Recovery duplicates use the furthest known endpoint for the same visitor/visit/document/interval ID, not a sum of partial and final rows. Unknown gaps are not filled.
- Raw event pagination still uses event occurrence time; interval totals may therefore include overlap from a completion row outside the displayed event window. This is deliberate, not a synthetic event.
- Direct SQL fixtures cover malformed payloads and anonymous inserts, midnight splits, clipping at both window ends, delayed completion, partial→final recovery deduplication, excluded recovery gaps and exact half-open boundaries. Real browser event payloads are also fed through the validator.
- Still a local review draft, NOT applied to any real database. A real historical-data preflight remains required before future authorization to apply it; a conflicting old row causes transactional failure, never deletion or silent rewriting.

Revision verification: 38 direct SQL rejection cases (all expected CHECK violations), UTC intersection tests also under America/New_York session timezone, real captured browser payload validation, 113 focused tests, typecheck, 3 browser checks and local build passed. No real DB execution.

## Review correction: event-specific fields and exact enumerations

- Successor to `05538b210993c99d77a43506511098c5f0934158`, SQL/verifier/docs only; runtime product files are unchanged.
- Every v2 event now has a common envelope plus its own exact extension, rather than one shared union of all event fields.
- `intent` belongs only to entry action/completion; `languageSource` to Landing/language selection; `storeType` to storefront interaction; drink/sugar/ice to milk-tea confirmation; `stage` to the cafe milestone. Shop IDs and auxiliary slot/order fields are similarly event-bound.
- String enumerations are the exact current `cleanChoice` lists, including all Chinese drink/specification/store labels. `scripts/history-event-enums.json` is a test contract checked against the actual client source; every allowed enum is exercised with both a valid old payload and a protocol-2 payload.
- Dedicated field ownership and enum validation also apply before the legacy fast path: valid old clients remain accepted, but private text or misplaced dedicated fields cannot bypass checks by omitting the protocol. This narrows malformed legacy data acceptance; it does not add metadata, rewrite or delete old rows. Future real-data preflight remains required.
- Direct rejection checks first require the new validation function itself to return false, then require INSERT to fail with the expected CHECK violation. In particular, `web_visit_state` with private `intent` text and with misplaced but otherwise valid `intent:'create'` must both fail.
- Real captured PC/mobile payload compatibility and previous midnight/window/recovery and RLS checks remain in the local in-memory PostgreSQL verifier. No real database or deployment is touched.

Event-field revision result: 75 direct SQL rejection cases (validator false plus INSERT CHECK failure), 148 accepted valid old/current enum payloads, 74 captured PC/mobile payloads validated; previous interval, recovery and owner/anon checks pass. Runtime product files are unchanged from 05538b2, so prior type/browser/build evidence is reused, not rerun or relabelled as fresh. SQL remains unapplied.
