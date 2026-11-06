# R3 entry owner: stopped for independent verification

Base 7d5fa3181d8c80d2deee10b9df222082b01498cc in the dedicated r3 workspace. R2/R1/407/E/shared repos untouched. No stage/commit or tests/build/browser/server run. No StrictMode removal, exception-injection removal, error suppression or recovery requirement relaxation.

## Evidence and bounded diagnosis

Read terra-r2-7d5fa3/render-fault-18sec.json, its runner and corrected spec, R2-acceptance-summary.md, and full.log. Development actual render injection logged BOUNDARY_RENDER_SENTINEL in the boundary, then pageerror save-session-stopped; after 18s the world cover remained and recovery was absent. Production injection recovered. The pageerror handler saved only message, not its stack, so the exact secondary throw site is not proven by this artifact.

Confirmed reachable lifecycle gaps in R2: the captured entering effect clears recovery before establishing current operation identity; the import callback tests only local cleanup, not controller/result/terminal identity; the boundary has no own visible fallback before parent recovery state commits. Closing a failed handle is synchronous revocation, so a development retry must not clear recovery or adopt that same handle again.

## R3 changes

runtimeRecovery synchronously latches failed handle identity before close/onStop, retains first and subsequent evidence, and refuses resetting that terminal identity. canAdoptRuntime requires the current entering result by identity, nonterminal handle and nonrevoked status. App applies it before clearing recovery, in import completion and acknowledged readiness. A current handle already closed before adoption/import reports failure rather than silently waiting. Healthy StrictMode cleanup is not marked terminal. Boundary renders its supplied store-independent recovery fallback while parent updates are pending; it stays mounted across runtime removal.

These are source-level repairs, not a claim that the development incident passed. Terra must repeat the same actual injection with StrictMode on; the revised spec now saves full pageerror stacks even on failure. If the secondary error persists, use its actual stack instead of guessing a further fix.

## Remaining test assertion and delivered E2E correction

full.log's sole candidate-only Reader shared click-group failure was an App source assertion for onTransitionReady={readingEntry.isActive ? readingEntry.handleTransitionReady : undefined}. It is incompatible with the approved public Center entry. Only that assertion is replaced by Center acknowledgement and actual owner Reader notifyTargetReady wiring; existing Reader module language/mode/click-group/animation assertions remain. No skip/delete.

The dev E2E still injects the exact throwing runtime module. Start/recovery/entry waits are explicit bounded 15s within a 60s test. Actual scene is .center-experience, not nonexistent data-scene-id. It still requires visible recovery, correct first cause, enabled recovery controls, safe return and no uncaught pageerrors. Source-conflict authority byte invariance remains. The spec is dev-module-injection-specific; production injection must use Terra's corresponding built-chunk runner.

## Handoff

Nine changed/new product/config/test files and SHA256 are in save-entry-r3-entry-manifest.json. Dedicated discovery includes runtimeEntryIdentity tests. Node latch/fallback tests are written but not run; they do not prove browser StrictMode behavior. Run dedicated tests, retained readerShellContract, typecheck/build and the original dev/production render incident plus normal StrictMode/source conflict/debit/prepared cases. No unrelated shopOrderCompletion changes by this owner.
