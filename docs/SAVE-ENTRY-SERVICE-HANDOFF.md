# Save-entry service construction handoff (pending joint freeze / Terra / Sol)

Only the independent repository is edited. Candidate baseline commit33ba1d3e570d07505833f9a8a9a136dd8d27104b has explicit parent bddf114495588ef0eab8bfd1ec100a2ab259177a. Its707 files /6339685 bytes match the independently supplied E candidate tree fingerprint749fc1e9ed8a1864e7101d8e3089b3c5d668f9efb81b7dc3c3fded498893db80. This is not a claim of zoom2 build provenance. No stage/commit after the initial baseline snapshot; publishing owns the final shared index/freeze.

## Entry contract

Import `getSaveEntryService` from `src/services/saveEntryService.mjs`. Import and factory construction do no storage IO. `createSaveEntryService({storage,locks,digest,uuid})` is also exported for actual-module tests. The browser singleton uses localStorage and navigator.locks only when a method is called.

- `inspectSave()` returns status ready/unavailable; classification empty/historical-supported/generation-current/unknown/corrupt/conflict (or null for unavailable), allowedActions, reasonCodes, snapshotToken and preview. Unknown/corrupt/conflict permit only back/reinspect. Pure preview contains complete UI preferences plus preserved/defaulted/derived field lists and Landing learned/not-learned/unknown; invalid Reader text is not a Center failure.
- `prepareEntry({intent:'create'|'continue'|'replace',snapshotToken,overwriteConfirmed})` returns prepared+ticket, stale/busy/blocked, or outcome-uncertain+ticket when a prepare write might have succeeded. Cancellation never calls prepare. Tickets and hashes come only from the service, are persisted and recoverable.
- `commitEntry({ticket})` returns committed with ticket, receipt, verified snapshot, new sessionHandle, and nonblocking warnings; or a failure/uncertain result. Old handles are revoked before candidate persistence and a second snapshot check; entry must not revoke them itself.
- `getRecoveryState()` returns no-pending-operation, operation-found+ticket+phase, or blocked. A successful scene-ready acknowledgement makes normal startup no-pending-operation without deleting operation/backup evidence.
- `resolveOperation({ticket})` returns committed with the same complete adoption payload, busy/blocked/unresolved/superseded, or not-committed+resumeAllowed:true. Only that last explicitly verified result permits `commitEntry` with the SAME ticket. Do not call prepare again, invent hashes or replace an operation ID.
- `acknowledgeEntry({ticket,sessionHandle})` is called after first scene ready while the entry shield remains. Only acknowledged completes handoff. Failure does not report ready; recover/retry the same ticket. It requires the valid owned handle and lifetime lock. It does not delete pending, receipt or backups.

`sessionHandle` exposes generation, storage, check(), close(), onStop(callback). The service installs its storage for Center/domain adapters. onStop must unmount the old game; retained handles/store callbacks are invalidated. The facade checks journal and necessary sources on every access/write and via storage/visibility events plus250ms monitor, cleaned on revocation. Web Locks coordinate cooperating service sessions, not arbitrary old code.

Preview shape:

```
preview: {
  preferences:{language,readingMode,themePosition,standardTheme,motionMode,
               hasInitializedLanguage,hasInitializedReadingMode},
  preferenceEvidence:{preservedFields,defaultedFields,derivedFields},
  landingIntro:{status:'learned'|'not-learned'|'unknown',
                learned:true|false|null,source:'journal'|'physical'|'absent'|'invalid'}
}
```

`LAO_ZHOU_TRIGGER_UNKNOWN` is returned in warnings without disabling safe continue. Entry may show informational copy; do not classify it as a damaged Center save. Historical default not-started/cursor0 cannot disprove a former unrecorded seat-guide dialogue. New generations write versioned explicit trigger evidence; both future main-story and Lao Zhou seat-guide starts persist true. Existing main-story phase dialogue at cursor0 is already positive, independently of completion.

## Persistence and migration

Authority key `newtone-save-entry-authority-v2` holds protocolVersion2, generation, revision, origin/source lineage, one-time placement result, values, original sources/archive, operationReceipt and spatial recovery holds. This is an engineering protocol, not a historical game release version. Main logical key remains E's `newtone-player-save-v1`; runtime facade maps it into the authority. Pending/ack/backup control keys are separate. Original physical player/Reader/narrative/Landing keys are never overwritten/deleted.

Registered historical shapes: complete website v1 with strict known extensions; exact current candidate v2; evidenced bddf v2 differing only by absent shopOrderHistory; schema1 prototype journal with independently validated main and matching necessary sources; ancient v2 phone with explicit valid scene and supported positions. Unknown schema/fields and incomplete main never get sanitizer-default success. Ancient v1 without a reliable current scene remains unknown. Schema1 Reader logical/raw values can be malformed and remain archived, not interpreted as Center. Existing migration credentials without their journal, or acknowledged service progress without authority, stop automatic reinitialization.

Only continuing an accepted historical source is eligible for placement, evaluated BEFORE conversion: original scene in ancestral home/interior/passage/office AND original phone surface. Set commercial-street authored initialPlayerPosition and inner phone together, preserving other facts. New/replace creates a new generation with new-exempt; current-generation continue never reevaluates placement after returning to surface. Existing street/surface schema1 phone repair remains explicitly supported.

Continue keeps wallet, phone data, exploration, completed story, order history, pending orders/held item/payment/monthly receipts and delivery records. Unknown fields/records that would be cleaned away are refused. Unfinished Cafe dialogue restarts at segment0 or2; delivery cursor1 and returning business phase remain; Ruoyu unfinished restarts0, completed never rewinds. Full raw sources and source hashes remain available.

Reader retirement: original raw retained, no old addresses/completions/events imported, no history query or body-dependent Center gate. Valid UI preferences are extracted separately, with explicit default evidence for unreadable sources. Existing new-service Reader logical state is preserved on Center replacement; no global Reader reset. Landing legal learned state and motion preferences stay; Center player data and choice-wheel teaching are new on confirmed replacement. Retired physical Reader changes are ignored for conflict guards and not appended/copied on subsequent resumes. Optional catalogue fetch remains3s bounded, pure until selected; late outcomes cannot activate content or reject unhandled.

First migration/create and destructive replace require a verified raw backup before authority commit. Normal current-generation continue uses the bounded pending record and does not create redundant full backups. Necessary backup/commit failures stop success. A write that may have succeeded returns uncertain; receipt verification recovers without rollback or another800. Acknowledgement is separate from commitment. Necessary source changes stop stale writers; old code cannot overwrite the new authority by changing its old slot.

## Spatial and SMS runtime

Migrated pending Cafe route/dialogue or seat creates a spatial hold. Old seat identity is preserved as evidence; it does not imply the protagonist is seated at the new street birth point. Held Cafe NPC business is not advanced off-space. Returning to Cafe space releases non-seat routes; a to-seat delivery waits for actual valid seating. Existing to-seat/returning targets, orders and receipts persist. Held dialogue does not lock the player before reseating; it resumes at the approved boundary after release. Normal ride auto-arrival/boarding is gated to its actual source scene.

New game persists opening pending unconditionally. Positive old conversation evidence suppresses only the new opening pop-up; negative versioned evidence allows pending; unknown preserves/report warnings and defers it without blocking Center. The arrival label may be staged while pending, but displayed is saved only after WorldPhone is fully open and the correct message thread mounted. Existing arrival timestamps, completion-phone pending/displayed state, other notifications and unread flags are not fabricated or cleared.

## Validation and prerequisites

Construction performs syntax/transpile only. No regression, semantic typecheck, build, browser or dev service was run. The targeted suite is `vitest.save-entry.config.mjs`; tests call actual service/App persistence modules with synthetic storage and lock managers. Existing152 R6 passes certify only the prior isolated package, not this integration.

This new source repository intentionally has no node_modules; no dependencies were installed or copied. Terra needs the exact package-lock dependency tree supplied/approved before executing:

```powershell
node .\node_modules\vitest\vitest.mjs run --config .\vitest.save-entry.config.mjs
node .\node_modules\typescript\bin\tsc --noEmit
node .\node_modules\vite\bin\vite.js build
```

Run commands separately and stop on failure. Then execute the full affected regression set and isolated browser matrix: empty/create, continue/replace/cancel, rapid duplicate input, normal acked refresh returns choice, interrupted preparation/commit/ack, fresh handle lock contention, lost authority/orphan evidence, large retired Reader noise, four-scene AND phone eligibility and no repeat, rich650 balance/history/receipts, actual Cafe reseating/to-seat/returning/pending presentation, old already-triggered/missing-short-dialogue/explicit-untriggered/new opening, fast phone close before open, normal completion message and source-change shutdown. Preserve all test profiles/results, inspect owned processes cleanup and exact final joint source hashes. Independent Sol review follows the common frozen version.

The initial snapshot commit is the only commit created here. Do not claim the worktree clean or a final implementation commit until publishing freezes both owners. No changes to original E tree/shared refs/staging/main/old branches, no fetch/push/deploy/deletion. Later staging trial merge is publishing's separate isolated task.
