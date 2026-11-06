# 0.3.0 anonymous player history

## Final model

Each anonymous browser visitor has time-ordered sessions. Store actual scene/room changes, sampled movement, one final record per interaction, existing story completion, and real-time checkpoints. Derive overall trends from these raw facts; do not maintain individual object counters. The earlier isolated implementation and diff are preserved in the parent workspace `.analytics-v030-evidence/pre-unified`.

- `main.jsx` installs one public lifecycle owner outside StrictMode. Background time is paused. Checkpoints run every 15 seconds and on hidden/pagehide.
- `analyticsRelease.js` fixes release/environment at creation. The Vercel wrapper selects production only for main and staging only for staging; other builds are preview/development. Never relabel historical/queued facts at upload. A release/environment change starts a fresh analytics session while old queued identities remain unchanged.
- Runtime positions, not door clicks, feed `setAnalyticsLocation`. Existing `mainlineSceneRoomAtPosition` resolves real membership, including Cafe inside commercial-street. Scene/room visits use existing event types and one visit UUID in `step_id`; max cumulative checkpoints avoid double addition. Snapshots do not feed positions.
- `interactionSessions.js` owns a final raw `center_object_interacted` row: anonymous visitor/session, start time, source location, object/content IDs, foreground duration, end time/result. Text/options/reply keep the stable display session. StrictMode cleanup is not an end callback. A fresh session is a new interaction even for the same object.
- Shared Page display lifecycle connects all normal observations/dialogue/menu choices once. Seat and timed fixture start/end use actual state boundaries. The existing reveal callback's approach time is deliberately not used. Phone app presentation has one begin/end pair, not per-button events. Shared persisted order/claim/consume results annotate their active interaction; instantaneous actions without a sustained lifecycle have NULL duration.
- Existing bypasses are the common phone UI, shared commerce transaction callbacks, and sustained seat/fixture mechanisms. New objects using the common scene flow inherit coverage. New bespoke UIs must connect the same lifecycle; no automatic coverage is claimed for arbitrary bypasses.
- Existing Lao Zhou/Ruoyu state transitions to complete yield one completion fact; replay, hydration and namespace migration do not create completion. No per-line telemetry. Future plots must use/register their real authoritative completion condition.

## Reliability and meaning

Foreground duration is real time, never accelerated game time. Possible idle is visible time after 30 seconds without movement/input; reading may continue during it, so it is not proof that a person left. Gameplay totals sum real visit time, excluding Landing/background. Frame/clock and checkpoint boundaries have finite resolution.

Active interaction snapshots stay in sessionStorage to avoid one tab interrupting another tab's interaction. On an abrupt-document recovery, retain the same event ID and only the saved duration lower bound, marked interrupted/partial. Pagehide closes known live interactions as interrupted. Completed raw rows have individual atomic localStorage keys, so an old array snapshot from another tab cannot overwrite them. Existing queues remain compatible; unique client_event_id protects retries. A queued completed record wins over a stale partial recovery. Storage failures and a player never returning after force-kill can still lose facts; this is not a complete or financial ledger.

No free text, messages, notes, payment key, raw order ID, device fingerprint, or URL query is collected. Content refers to existing authored IDs. Anonymous IDs identify a browser installation/session, not a verified person or cross-device identity.

## Owner view

`/admin/analytics` shows merged daily time/possible-idle trends derived from raw visit checkpoints, scene/room totals, and a paginated chronological player history. The owner can select an anonymous visitor or merge everyone. Each page contains at most 500 records; loading earlier uses a timestamp+database-ID cursor. Movement retains the existing 1s/1.5-world-unit sampling, not every footstep. Period boundaries have approximately one checkpoint interval of error. Untagged history stays unclassified. Historical legacy reports are separate, not the new timeline's data source.

## Database compatibility and rollback

All six migrations are additive to the existing table and owner RLS. No counter table or historical-row rewrite. The early six entry/shop names remain accepted for compatibility, but the final interaction history uses the common raw event. New 0.3.0 raw payloads have a strict JSON whitelist. Only aggregate/history-required columns gain authenticated SELECT; existing owner-allowlist RLS still determines row access. Anon cannot SELECT or execute reports. Functions use SECURITY INVOKER with an empty search_path. No client service-role secret.

Production project was independently matched to the official site's public JS: `bxowbscoffhmavrccxnm`. The isolated staging project is `ksrvlkcpaiowhcvzimkc`. Initial approval review rejected the last two production migrations; read-only checks proved they had not executed. After direct production-binding proof and explicit compatibility/rollback disclosure, each was retried once through the normal migration tool and approved. No alternate execution route was used.

Rollback the frontend release if necessary, disabling the new owner queries while retaining compatible additions and collected facts. Do not delete events or narrow vocabulary beneath recorded rows. Keep the previous main commit in a backup ref. Old clients and untagged rows remain valid.

## Focused verification

- `node node_modules/vitest/vitest.mjs run --config vitest.analytics.config.mjs --configLoader native`
- `node node_modules/typescript/bin/tsc --noEmit`
- Set intended public Vite variables, then `node node_modules/vite/bin/vite.js build --configLoader native` on Windows. The existing Linux-oriented npm wrapper fails on this Windows Node version; Vercel uses Linux npm.
- `supabase/tests/analytics_release_v030.sql` executes only in staging and rolls back synthetic rows. It checks unique IDs, rejected free text, NULL duration, max/baseline accounting, history ordering/filtering and non-owner denial.
- Entry browser checks retain the same-node, animation, layout and save safety assertions across three viewports. The old loading screenshot check could run after legitimate game entry unmounted Landing; identity is now asserted on actual visible animation frames instead.
- Parent workspace `.analytics-v030-evidence/real-entry-events.json` and `mobile-real-entry.png`: actual start/create, reload/continue, real room, app session (no row before close, one unique row after close), and pagehide. Same-ID retries are checked in staging SQL.

Do not describe these focused checks as a full game audit or claim historical completeness.
