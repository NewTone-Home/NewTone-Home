# Three drink shops: entrance-end counters and wall-embedded signs

## Scope and candidate

Baseline: application `6dc15963301c2adcf9eb7759cff31119d3096694` (public 4217), repository HEAD `3e10a56763bf3ccfadbdf7ddc45bcaf0d648c568`. Branch `preview/four-shop-interiors-20261021`, the existing four-shop worktree. Tracked tree was clean before this task. Protected untracked `.tmp/` and `.codex-test-tmp/` were retained. No source in any other worktree was edited.

**Local candidate: http://127.0.0.1:4219/**, PID41192, frozen `.tmp/drink-layout-correction-v2-dist`. Public4173, its dishes tunnel and frozen4217 are unchanged. The first local4218 candidate is superseded: its Cafe menu was embedded correctly but lacked the exploration pool needed to show an observation. This was caught by an actual click, then corrected before freezing4219.

| Resource | bytes | SHA256 |
| --- | ---: | --- |
| index.html | 2277 | 5e56edfba79491754687e3d2a9eb847e9ac037ab2656c25cd7f3a9d3b0042361 |
| index-BxlN5tnB.js | 858976 | 0153e44f198cf283fbfd0a01a1e79e7c80b3b8dc4d8d0cf83218d67d0ad5e78d |
| index-CGh3wNIs.css | 200573 | 2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039 |

All three resources read back HTTP200, byte-identical to the frozen files. No new device-scale policy, PWA, plot, clock or business simulation was added. This is a local visual/function candidate, **not author acceptance or authorization to publish**.

## Plain-language before/after

Coordinates below are room-local reference pixels, top-left origin. Existing shell sizes stay Cafe672x700, milk336x700, fruit336x700. Ordinary letters16, furniture pitch16, walls28 and device projection are unchanged.

| Shop | Before | Candidate |
| --- | --- | --- |
| Cafe (street front at bottom y700) | Left vertical counter x168; short arm at rear y112 extending right into customers. | Vertical counter x176, y112..560; short arm at front y560 returns **left to the wall**. Employees go around the upper end, not through the closed front arm. Four tables/eight seats and their story IDs stay in place. |
| Milk (street front at top y0) | Right counter x224; small return at rear y560 extends left into customers. | Right counter x208; short arm at front y112 returns **right to the wall**. Employee opening is at the lower end. Four work devices align at x280; no equipment is in the public left side. |
| Fruit (street front at bottom y700) | A left/rear L encloses a broad rear area; equipment scattered across it. | Left counter x128, y112..560; short arm at front y560 returns **left to the wall**. Cold storage, boiling, washing, fruit cutting and packing align at x48. The upper end is the employee entrance; the right/public side stays open. |

Counter arms use16px centre steps and end one16px centre from the wall centre: their visible16px cells meet the wall's inside face, rather than extending into the customer space or leaving a human-width passage. Bodies are exactly the union of their visible cells. The two Cafe bodies contain39 unique cells, milk36, fruit36; elbows do not duplicate a glyph or overlap body area. No invisible oversized furniture was added.

### Working side, kitchen and doors

Cafe's continuous left work strip now contains cold storage, coffee machine, preparation and washing. It is a real preparation area with a continuous employee path, not an indoor warehouse or a claimed cooking system. The preserved employee service/preparation target IDs remain. Cafe's one rear warehouse door moves from localx336 tox84; customer toilet staysx560, locked and unmoved.

Milk's work lane extends to its one rear door, moved fromx168 tox280 so it is inside that employee lane. Added boiling position; existing tea/sealing/washing device IDs retained. Fruit's rear door moves fromx168 tox56 inside its left work side; added boiling position while retaining the four prior device IDs. All three existing rear passage IDs and lock permissions are preserved. `employeeRearDoor` moves the one portal endpoint, thresholds, crossing target and one wall-opening source together. The old centre is ordinary solid wall, not a disabled/invisible second door. No warehouse interior or extra door was added.

### Wall signs and old service functions

`embedCustomerWallText` resolves the actual boundary owner before adding an `inline` feature, just like the existing portrait mechanism. In particular, fruit's right wall is painted by its neighbouring shell's left edge; the helper updates that owner instead of drawing a duplicate right wall. Two menu/blackboard glyphs **replace** two existing wall slots, remain collision-solid and are not door openings. Contact anchors are on this shop's customer side.

Cafe menu/blackboard are now right-wall features; milk menu is in the left wall; fruit menu is in the right wall. IDs are retained and each has an actual observation pool. No floor duplicate remains.

Ground words `点单`, `取餐`, `取货` were removed. Their existing IDs now name interactive **柜/台 cells** on the actual long counter, with public-side continuous-counter contact. Cafe's original `commercial-cafe-counter` still owns `cafe-order`; the order choice/state machinery was not deleted or rewritten. Tea service IDs remain observation endpoints; no commerce system was invented.

Equipment now uses existing interactive/observation presentation instead of all being inert34%-opacity text. Each keeps a visible-character-sized body and a plain description. **It has no boiling/cleaning/production action:** unauthorized customers still cannot enter the work side merely by clicking a machine. Employee contact paths are tested separately. No global CSS brightness or other-scene interaction rule was changed.

## Actual code diff and tests

- `src/center/runtime/shopInteriorTrial.ts`: new actual-owner wall embedding and single-door relocation helpers; `trialCafeInterior` corrects counter/work-strip geometry and signs; `buildTakeawayTrial` places retained service IDs on counter glyphs and gives devices observation descriptions; `trialTakeawayInteriors` supplies the two distinct corrected layouts.
- `tests/drinkShopLayoutCorrection.test.ts`:16 new cases covering front-arm direction/wall closure/16px pitch, unique character bodies, retained public service paths, true wall replacements and closed collision, all employee equipment/rear approach routes with16px bodies, old contact positions recovering in the same room, Cafe eight seats/toilet/order identity.
- `tests/cafeAccessFeedback.test.ts`: the old physical lower opening no longer exists after the front arm is moved there. Its permission assertion now checks the actual upper-right access of one finite work strip; raw denied intent, staff-role access, no region-sized physical body and unrelated north2..6 legality remain asserted. This is an explained layout-contract replacement, not removal of permission tests.

Final selected run: **6 files /70 tests /70 pass /0 fail /0 pending**: new correction tests, Cafe access feedback,14 rear-wall/old-extra-door checks, seating, original Cafe story and behavior. Typecheck, isolated Vite build and diff-check pass (existing large-chunk advisory). Evidence `.tmp/drink-layout-correction-final-tests.json`. Earlier43-case run also passed; no full-suite claim is inferred from either count. Existing full-suite baseline had11 historical failures; this candidate's full suite and other old layout-specific numeric contracts have **not yet been reconciled or rerun**. Follow independent visual review before the final combined regression batch.

## Actual browser evidence

Chrome fresh isolated contexts; no actual user profile/save was read or modified. All own browsers closed after captures.

- Three1920x1300 room views, actual full-room crops and raw pointer clicks on all three embedded menus. Each reaches the customer-side contact and shows that menu's observation; zero page errors. `.tmp/drink-layout-correction-v2-browser/results.json` and `cafe-full-room.png`, `milk-full-room.png`, `fruit-full-room.png`. Images were opened and visually inspected, not only DOM-counted.
- Normal front-door clicks enter and exit Cafe and milk at1280x800; fruit at1280x800 and390x844 uses the **actual safe initial arrival** `(22.2083,41.4072)`, normal mouse/touch enters to `(22.2083,27.4072)` and returns to the street. Zero page errors. `.tmp/drink-layout-front-smoke/results.json` plus entry/inside/returned PNGs.
- An earlier smoke seeded fruit directly at the old six-unit threshold `(22.2083,39.4072)` and timed out trying to enter. This is the same unsafe approach distance previously rejected in the A stage, not the authored new-game arrival. This attempt is recorded, not counted as passed; the exact present-time obstruction at that injected point was not re-investigated here. No runtime change occurred between that attempt and the safe-arrival smoke. It must not be described as all arbitrary old doorway positions being safe.
- Old counter-contact recovery is covered through the existing same-room safe-spawn function (three cases, legal public path and idempotence), not by clearing saves or adding a global reset. Normal runtime continuation of all historical room positions, live Cafe service/departure, all-seat physical-device behavior and independent QA remain to be checked; the70 unit passes are not a substitute for those.

## Mine measurement: paused at one real ambiguity

No mine geometry, Yonghe layout, migration or live mine version was changed. Current4217 mine still has25 depth intervals/700 reference pixels, so the author's `effective frontage * 2` requirement is **not completed**.

Effective frontage excludes the shared separators: two-letter store3+2+3=8, three-letter9, Yonghe3+4+3=10. Required depth counts are16/18/20. We must not silently interpret20characters as20intervals.

Two precise possible endpoint conventions for confirmation:

| Definition of the depth count | Two-letter16 | Three-letter18 | Yonghe20 |
| --- | --- | --- | --- |
| Count includes the front/rear end centres | 15 intervals=420px | 17=476px | 19=532px |
| Count excludes both end centres like effective facade content | 17 intervals=476px | 19=532px | 21=588px |

Neither option is chosen or implemented. After confirmation, mine shells/doors/furniture/people and the versioned same-room old-save mapping must be changed together. Commercial street shell dimensions are not resized to make mine figures fit.

## Remaining boundary

Author aesthetics and independent QA are pending. A future whole-suite run must explicitly classify changed layout contracts versus real regressions; no deletion of old tests to force green. The current isolated candidate does not authorize public replacement. No push, main/staging/Vercel, new scale curve, PWA, world clock, new plot or real-save edits occurred.
