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
