# R3 order completion owner — stopped for freeze

Base: 7d5fa3181d8c80d2deee10b9df222082b01498cc, tree 41cf9046bc8527937d4d3a1f9c333b5859ea132a. Changes only in R3; frozen R2, earlier candidates, original E, shared Git metadata and services were not edited. No stage/commit, dependency changes, tests, typecheck, build, browser, push, deployment or deletion.

## Product fix

src/center/runtime/shopOrderCompletion.ts changes one condition: nextOrders === orders controls copy-on-write instead of !changed. Notification cleanup can already set changed before a due order is processed; copying now independently protects the caller's order table. New due-order records are copied; untouched orders retain their references. Notification filtering/enqueue rules and completion timing are unchanged. This protects the actual Center updater -> position coordinator -> savePlayerSave -> persistence -> publish order. No Center/entry/StrictMode file changed.

## Tests prepared (not executed)

The existing two test cases remain. The one authorized obsolete expectation now checks Yonghe's durable completion flag without a phone notice; milk/Cafe/fruit notices and idempotency remain asserted. The product's manual Yonghe cue behavior is unchanged.

Five new cases (one parameterized pair):

1. Frozen old Yonghe notification + multiple due orders: no input mutation, due records copied, later-order identity preserved, unrelated ride notice and other-store notifications retained, repeated completion no-op.
2. Same protection with orphan ready-notice cleanup, which triggers the same alias defect independently of Yonghe.
3. Notification-only cleanup leaves a not-yet-due order table/record untouched and unmarked.
4. Actual createPositionSaveCoordinator updater calls notifyDueShopOrders and savePlayerSave with throwing storage: expected player-save-write-failed, zero publication, unchanged old memory/deep snapshot/completion facts/balance/payment receipts and original storage bytes.
5. Same real updater/coordinator/savePlayerSave chain with working storage: old snapshot remains unchanged during persistence, publication occurs only afterward, stored result matches published result, other shop/ride/balance/receipts preserved, second invocation does not persist or publish again.

Both files passed TypeScript syntax parsing only, with zero parse diagnostics. Terra should run from R3 using the existing approved dependency setup:

```powershell
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/vitest/vitest.mjs" run --config vite.config.js src/center/runtime/shopOrderCompletion.test.ts
```

Then perform the joint regression/typecheck/build and targeted UI checks after supervisor freeze. No PASS claim before those results. No attempt to change the other baseline failures or notification design.

Manifest and patch cover this owner's two-file delta against frozen R2, not the concurrently edited joint R3 tree. All this owner's writes are complete.
