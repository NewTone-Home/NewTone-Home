# R4 save owner — stopped for quick checks

Base ab098d7a96fe67adce16775aae5e450d4986f2dc / tree f6d5ce5d30e51bddcb26f983c778cb40fe8f8244. Changed only this R4 owner scope. R3 production-test source/services and all earlier workspaces remain untouched. No stage/commit, runtime tests, typecheck, build, service, dependency changes, push/deploy/delete.

## Type boundary

shopOrderCompletion.test.ts passed recordPlayerScenePosition (MainlineSceneId parameter) to a generic coordinator that accepts any string scene ID. Added one test-local adapter recordCompletionPosition(save, sceneId:string, position:PlayerPoint). It throws unless sceneId equals the saved current scene, then calls the real recordPlayerScenePosition with typed save.currentSceneId. Both failing callbacks use it. No any, cast, ignored scene ID, no-op position function or weakened production interface. Order updater/persistence/publication assertions and all seven existing cases remain.

## React development introspection

Observed stack: React DEV addObjectToProperties -> object[key] -> storage facade length getter -> check -> save-session-stopped after boundary teardown. The facade now uses a local object and Object.defineProperty(facade,'length',{enumerable:false}). This preserves its original getter/check and makes only enumeration skip the protected data accessor. It does not return a cached/zero length, suppress real read/write failures, alter capability lifetime, or reactivate a handle.

Reviewed other own enumerable getters in the actual facade: isOpen, stopReason, revision read local diagnostic state and perform no protected access. Service handle getters isOpen/stopReason are likewise metadata. They are unchanged. memoryStorage.length is an unprotected test/private-memory counter, not the stopped journal facade. No other getter requires the same fix.

Two new actual-service/facade tests:

- Live and revoked nested React-style own-enumerable property traversal, Object.entries/assign/JSON and descriptors are safe with zero raw getItem/setItem calls; length descriptor remains a getter and non-enumerable; original raw remains unchanged.
- After close, explicit length/getItem(existing or missing)/key(valid or out-of-range)/setItem/removeItem/transaction/afterCommit/setValidator/check remain rejected, callbacks do not run; clear and explicit descriptor getter invocation also reject. Original old JSON, authority, receipts, pending/backup evidence and first stop reason stay unchanged.

Entry fallback readiness and first-reason propagation are owned by the entry group, not claimed fixed by enumerability alone. No App/controller/boundary edits here. The five timeout cases and their timeouts were not edited.

## Prepared checks (not run here)

Three changed source/test files parsed using existing TypeScript createSourceFile, zero syntax diagnostics. This is not typecheck or test success.

Terra, from R4 with its approved dependency setup:

```powershell
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/typescript/bin/tsc" --noEmit
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/vitest/vitest.mjs" run --config vite.config.js src/center/runtime/shopOrderCompletion.test.ts
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/vitest/vitest.mjs" run --config vitest.save-entry.config.mjs tests/saveEntryService.test.mjs -t "real facade"
```

Repeat the real StrictMode injected runtime render failure and source-conflict recovery cases, preserving first sentinel reason and usable controls; verify no secondary React enumeration exception, stale writes or duplicate commits. Then supervisor coordinates joint freeze and full validation. This owner's manifest covers three code/test files plus this handoff/patch/manifest, not a joint R4 snapshot. All owner writes are complete.
