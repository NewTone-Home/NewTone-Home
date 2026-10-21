# Cafe trial: restore feedback at the actual employee openings

## Why this is a runtime fix, not an assertion removed to turn tests green

The full run on mine migration commit `5cfac1f` completed **832 tests: 746 pass, 86 fail** (`.tmp/integrated-before-contract-reconciliation.json`). That supersedes the older pre-layout failure inventory; it is not a green suite. Contract reconciliation is being handled separately and is not part of this runtime commit.

One existing NPC foundation assertion requires a denied employee-area request to retain `deniedAccessRegion`. Reproduction with the actual Cafe shows the public actor stops safely, but the result lacks that field. `trialCafeInterior` authored the two staff permission rectangles without any `accessBoundaries`. `resolveMainlineWorldNavigation` derives its attempted-route permission contact and reason only from declared boundaries; otherwise its ordinary obstacle projection loses the access reason. Page already displays the existing denial text when that field is present, so no new feedback UI is required.

## Exact change

Only runtime file `shopInteriorTrial.ts`, function `trialCafeInterior`: add two semantic edges to the current regions, preserving unrelated boundaries.

```ts
{ id: 'commercial-cafe-staff-bottom-access-boundary',
  regionId: 'commercial-cafe-staff-area', edge: 'bottom' },
{ id: 'cafe-trial-rear-right-access-boundary',
  regionId: 'cafe-trial-rear-work-area', edge: 'right' },
```

These correspond to the actual lower employee opening and the right approach to the rear work strip. They reuse the existing actor-filtered access machinery. Public actors still cannot occupy these rectangles; authorized coffee owner still can. No room/counter/glyph/collision box, seat, door access, NPC identity, plot, save migration or device projection changes. No new region-sized physical body or furniture air wall is added. This does not silently restore the old horizontal counter boundary at its retired location.

`tests/cafeAccessFeedback.test.ts` adds four regressions: protagonist raw request and legal public-side route with denial reason; floor server using its real 16px label body gets the same public restriction; authorized coffee owner reaches the original requested point; correct two declared edges and no region-sized collision body. The existing failing feedback assertions were retained, and the related access/NPC/seat group passes 38/38 after using current room/footprint fixtures. New focused migration+feedback+label+released-seat group passes 19/19; typecheck/build pass, existing chunk advisory remains. Whole-suite reconciliation remains in progress, so neither 38 nor 19 implies all 86 failures are resolved.

## Actual browser check, isolated 4216

Frozen build `.tmp/cafe-access-feedback-dist`, server PID35780 at **http://127.0.0.1:4216/**. 4215 remains unchanged for independent mine migration QA.

- JS `index-O7BIMM_N.js`, 856851 bytes, SHA256 `48f3065fcdb8368be9fa87376779c1b0acb4f4da6699f1b881c5d426dd77169f`.
- CSS `index-CGh3wNIs.css`, 200573 bytes, SHA256 `2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039`.

Chrome 1280x800 and touch emulation 390x844: each fresh isolated completed-story save starts at the actual Cafe public front interior, then normally clicks/taps empty employee ground `(122.8333333,-0.2964889)`. The actor walks to the public side `(122.817/122.833,20.9735)` and the existing `这里是柜台员工区` text is actually visible. No app movement function or permission patch is invoked from the browser. Floor server has 30/41 distinct sampled visible positions and no sampled blocked state; this is a limited regression check, not full business AI or performance acceptance. Zero page errors. Evidence `.tmp/cafe-access-feedback-browser-v3/results.json` and the two denied PNGs; browsers closed.

Failed harness attempts are retained: the first fixture restored an unfinished Lao Zhou conversation and intercepted ground input; the completed fixture then correctly showed the denial but the script expected its final full stop, which the existing echo renderer omits. Final check matches the actual rendered phrase and confirms the public-side position. No application change was made to hide either harness issue.

Pending independent QA and full-suite reconciliation. Physical devices/Safari, all employee approaches, complete coffee narrative and performance are not reaccepted by this small check. Historical Yonghe survey counting and central abstract observation expression remain separately reported. Public stays bae6afb: A publication is still denied/pending direct approval. No push/main/staging/Vercel or real user save mutation.
