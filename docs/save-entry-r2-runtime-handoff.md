# R2 save/runtime owner handoff — stopped for joint freeze

Base a2ee2e8cd50a4c2299e2e17a19aa3a6b2527727a. Only R2 changed. No stage/commit, dependencies, tests, typecheck, build or services. Independent Sol Medium readback accepted from supervisor. This owner manifest supersedes the earlier intermediate six-file manifest in this same R2 docs path; R1/407 evidence was never changed.

## Three blockers

1. Lock release tracks completion of the actual navigator.locks.request promise, not only resolution of its callback. resolve/not-committed and uncertain returns wait for actual release; the next acquire also waits for this service's own release. Another owner's ifAvailable denial remains busy. No delay guess, polling or lock bypass, ticket regeneration, authority replay or repeated 800.
2. Center captures sessionHandle.storage once. Position and time persist closures cannot adopt a later ambient generation. Confirmed revoked capabilities skip cleanup persistence. Healthy normal unmount still flushes. Revocation cancels clock/input/visibility work, order/ride timers and position lifecycle, discarding only uncommitted position samples.
3. First terminal reason is retained by facade/handle. Unrelated storage-check errors still throw. A failed business write still throws and cannot publish money, orders, receipts or success. Entry-owned error isolation/recovery presentation remains a separate integration change.

Interface: handle.close() revokes synchronously, idempotently, and returns Promise<void> for actual release completion. ACK failure awaits it before returning. isOpen/stopReason are read-only runtime observations, not persistent save fields. No existing entry API change is required.

## Reader helper and changed contracts

chooseFurthestLocation first validates current against current content. It falls back to current only for a structurally valid previous address that no longer resolves. Invalid current, malformed previous, getter failures and unrelated errors remain failures. Valid later previous addresses never move backwards. Center validators are unchanged.

Updated exactly three authorized assertions: storage failure must throw without publishing game time/story clock; cutover must not delete any original game/Reader/layout/analytics data or write a marker; repeated calls, including with a historical marker, must preserve all bytes. No skip or broad test relaxation.

## Stable isolated preview API — entry owner must connect

From src/stores/progressStore.js:

- createReaderPreviewStores({ language='zh', themePosition=.5, motionMode='full' }={}) -> { progressStore, narrativeStore }, called after preview content validation/installation. Each call creates fresh private memory, valid first location, Reader-started/preferences initialization flags, and a private narrative store.
- ReaderPreviewStoreProvider({ stores, children }) wraps only the owner Reader root. Hooks use its stores; it never installs a game storage capability or calls the entry service.
- useProgressStoreApi() -> scope-local Zustand API, for command callbacks. Existing useProgressStore(selector) becomes scope-aware.
- src/stores/narrativeProgressStore.js exports useNarrativeProgressStoreApi(); its selector hook is also scope-aware.
- src/stores/readerStoreScope.js exports useReaderStoreScope(), including any optional transitionStore supplied by the host.

Public useProgressStore.setState remains absent. Raw APIs returned by the factory affect only that preview's memory, never a global/player store.

Host must stop importing Center App / calling missing wrapper.setState. ReaderOrchestrator.jsx's currentAnalyticsContext and scroll-offset initializer still use static useProgressStore.getState; replace those with the hook-acquired API captured by callbacks. transitionStore.js uses static player getState and global timers, so preview navigation needs its own transition store/commands supplied through the same scope; do not route preview return into Center. readingEntryController.js also has static command reads, if the host elects to use it; direct Reader mounting does not require it. These entry/Reader-host files were not modified by this owner. Provider alone is insufficient until these call sites are connected.

Cross-thread coordination message was denied by automatic review for lack of recognized explicit send authorization; it was not sent/retried. This handoff carries the interface instead.

## Tests prepared, not executed

Eight new service/runtime tests: delayed native-shaped release, prepared write-then-throw, healthy captured-storage teardown, source-conflict teardown, first failed business write, replacement-generation isolation, unrelated-check errors, ACK failure cleanup with another service recovering the same 650 save.
Five new Reader cases: valid previous remains furthest; invalid current rejected; malformed previous/getter errors rejected; separate private preview stores with no physical storage access; React server-rendered provider selects both local APIs. Existing failing preview regression remains in place.

16 owned source/test files passed syntax parsing using existing TypeScript createSourceFile only. No runtime tests are claimed PASS.

From R2 with dependencies made available using Terra's approved existing method (this window changed no links):

```powershell
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/vitest/vitest.mjs" run --config vitest.save-entry.config.mjs
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/vitest/vitest.mjs" run --config vite.config.js tests/playerSave.test.js tests/publicReleaseMigration.test.js tests/progressStorePreviewCompatibility.test.js
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/typescript/bin/tsc" --noEmit
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/vite/bin/vite.js" build
```

Terra should repeat native-browser source conflict, debit failure, prepare write-loss/reload/recheck with locks trace, plus ACK failure and normal unmount; assert visible recovery, no stale checkpoints, same ticket/generation, 800 once, old raw preserved and genuine other-tab busy. Also owner preview must neither mount Center nor read/create/overwrite its authority, including return and reload.

## 15 candidate-only failures

Source evidence: terra-r1-a2ee2e8/failure-comparison.json and full.log. One actual Reader comparison regression fixed; three explicitly changed safety contracts updated as above. Remaining eleven are App/main/Landing/Reader/analytics assertions, outside this owner's changes. Some inspect moved syntax, but semantic equivalence is not proven. In particular Landing-language analytics/browser_back telemetry cannot be dismissed only because the code moved. Entry owner/Sol should map them to current behavior. The 43 baseline failures were not changed. No all-green claim.

## Boundaries / freeze

No edits to historical recognition, one-time four-scene placement, Reader raw policy, Lao Zhou evidence, initial money, strict Center validators, source conflict checks, business transaction/receipt semantics or dependencies. R1/407/E/DB/true branches/4173 untouched. This owner's 16-file delta and three docs are now stopped; supervisor/publisher freezes joint R2, Sol audits and Terra validates. Preview host integration remains explicitly pending the entry owner.


## Approved warehouse / delivery / QR follow-up

Supervisor forwarded Sol's historical tracing: warehouse interaction existed in b5ff95acfb1820633e765914b871c8d0ff144938 and was omitted when the door moved into miningStreetShell.ts in the fixed E candidate. This window checked current source and its existing MainlineScenePage consumer; it does not claim to have read the original user thread or those commits directly.

Only product change in this follow-up: restore interactive:true and interactionBehavior:'yonghe-warehouse' on the current warehouse entity. No coordinate, wall, access, kitchen, room or target edits. tests/yongheInteriorTrial.test.ts retains both scenes' locked/no-target/alley-safe-approach/push-feedback assertions and adds explicit interactive:true checks.

No change to cafeStoryOrderDelivery.ts or commercialStreetShopApps.ts. Current product agrees with the approved rules: ordinary table completion atomically removes the order and creates heldConsumable; interrupted service retains returning-to-counter until counter arrival; any one valid QR installs the shared Cafe/milk/fruit app while scan facts remain distinct. Lao Zhou story delivery remains separate.

Updated the two old table-delivery assertions and four old shop-app assertions. Added a stale table callback after counter claim test and a shared-app three-order/balance isolation test. Existing ordinary delivery tests now also verify durable completion replay, no second counter claim even after the item is consumed, no story-delivery substitution, serialized return route, no premature new delivery during return, idempotent counter return, and full-hand preservation. Scan tests retain per-shop flags, no unlock before scanning, explicit-only synthetic unlock, and separate orders/balance/receipts.

Additional tests for Terra (not run here):

```powershell
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/vitest/vitest.mjs" run --config vite.config.js src/center/runtime/cafeStoryOrderDelivery.test.ts src/center/runtime/commercialStreetShopApps.test.ts tests/yongheInteriorTrial.test.ts
```

Real UI still needs warehouse approach -> push -> locked feedback, no internal transition, kitchen denied, Yonghe back-door roundtrip, ordinary delivery exactly once, seated icon hidden/standing icon shown, mid-delivery stand -> return -> restored order, and any QR -> shared three-shop app without crossing orders. The other baseline failures were not edited.

The previous 12-file owner snapshot was checked unchanged before this append. Updated manifest covers the full 16-file owner delta against frozen R1; it is not a joint entry/runtime freeze. Stopped again for supervisor freeze.
