# R2 entry/UI owner handoff

Only R2 changed; no stage/commit/reset/checkout, dependencies, test/build/service/browser runs or deployment. Base a2ee2e8cd50a4c2299e2e17a19aa3a6b2527727a. Product/test paths and SHA256 are in save-entry-r2-entry-manifest.json. Parallel save/runtime files are not entry-owned changes.

## Runtime recovery

App keeps RuntimeRecoveryBoundary mounted outside the conditional runtime child. Render/commit-cleanup errors report to createRuntimeRecovery, which records the first cause and bounded subsequent errors, detaches stop observation before close, and displays a store-independent bilingual RuntimeRecoveryPanel. Console receives original errors and component stacks; no error is presented as success. Return/reinspect never clears sources, tickets or receipts. ACK remains uncertain and scene reveal waits for acknowledgement; normal observer cleanup is not abandonment.

Center/runtime revoked-cleanup prevention is the save owner's separate required half. Only Terra can confirm the original conflict/debit blank-root incidents are resolved. Prepared lock sequencing is also the save owner's change; UI still uses the service ticket and explicit resumeAllowed, without lock bypass.

## Landing observation

createLandingEntryObserver calls the existing trackLandingEntry only after read-only preferences are available and Landing is visible. It deduplicates repeated effect setup and language rerenders, resets only when Landing actually leaves, and uses the same displayed preferences/browser-language resolver as the UI. Existing analytics supplies viewport metadata; no hardware identifiers or game writes are introduced. Actual accepted Center entry requests emit the existing center_entry_requested event.

## Author Reader preview

OwnerReaderPreview remains behind the unchanged authenticated AdminApp gate. It validates/installs temporary draft content, then creates private createReaderPreviewStores and a separate ownerPreviewTransition store, and mounts Reader in ReaderPreviewStoreProvider. No Center App, player service, physical storage, installation of a game storage capability, or global setState is used. ReaderOrchestrator's imperative analytics/scroll reads now use useProgressStoreApi. transitionStore's hook consumes the preview transition scope while public imperative APIs remain public. PageShell/GlobalTransitionOverlay/Reader return hooks therefore use the private transition store; release resets only its timers. Restart resets only this preview's current address. No original Reader or Center progress is imported/deleted.

## Regression assertion changes

- analyticsObservabilityContract: public Center funnel separated from still-valid Reader module events and legacy browser_back dictionary; dictionary and privacy checks retained.
- entrySurfaceContract: behavioral world-entry reducer gating and stable recovery shell replace retired public Reader handoff expectations.
- landingEntryLanguageAnalytics: real observer/resolver dedup behavior replaces old App effect text matching; existing language payload matrix retained.
- landingUpdatesEntry: inspect-before-begin and known not-learned marking replace exact begin() text; other visual/navigation assertions retained.
- readerShellContract: Reader controls remain; owner preview return replaces public Reader-to-Landing wiring. No suite skipped.
- releaseBoundary: admin authentication, owner checks and Reader tools retained; public Center is independent of publication availability.
- startupLanding: controller can create without a Reader publication; no public publication fetch/Reader boot restored.

Save owner separately updates storage-failure, cutover and bounded preview-location assertions. The 43 baseline failures are not batch-edited.

## Not run / QA commands

Run the dedicated Vitest config (now includes warnings/ACK/lifecycle/recovery/preview/observer suites) and all seven affected contract files. Then typecheck/build. Run e2e/saveEntryRecovery.spec.ts only against an isolated local Vite context; its render-error injection is dev-module-specific. Repeat Terra's real Cafe debit-write and source-conflict scenarios and prepared lock traces against the frozen production build. Verify authenticated owner draft render, navigation, return/restart and unchanged player physical storage in browser. Node boundary-method tests do not prove browser lifecycle behavior.
