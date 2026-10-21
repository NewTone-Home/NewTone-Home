# Integrated trial: contract reconciliation and remaining failures

## Result (actual whole-suite runs)

| Run | Files | Tests | Pass | Fail | Pending / todo |
| --- | ---: | ---: | ---: | ---: | ---: |
| 5cfac1f, before reconciliation | 149 | 832 | 746 | 86 | 0 / 0 |
| 6dc1596 runtime + final test changes | 151 | **839** | **828** | **11** | **0 / 0** |

Final run took **168253ms**, one worker, 120000ms per-test timeout. It was started after the last assertion/code edit; no test or code was edited while it ran. Evidence: `.tmp/integrated-before-contract-reconciliation.json`, `.tmp/integrated-after-contract-reconciliation.json`, `.tmp/final-contract-failure-inventory.json`. Seven new cases come from the five Cafe access feedback/locality checks and two wall-coverage ownership checks. Existing case count was not reduced; there are no newly skipped/todo cases. Case count alone is not a proof of equivalent coverage, so the replacements and reasons are listed below.

This is **not all green** and is not author acceptance of the four trial interiors. A new isolated build after the run passes typecheck and Vite build; its `index-C6XP-qXn.js` is byte-identical to frozen 4217 (856911 bytes, SHA256 `4dc85baf89f97e460182162f73e131100d34a842ee97ee287f45be21b63b39a5`). Existing >500KB advisory remains. `git diff --check` passes. No additional application behavior changed in the test reconciliation commit.

## What was migrated, and why

The old tests mixed two retired Cafe implementations, former layouts, default viewport-derived world metrics and earlier interaction rules. They cannot require an explicitly deleted independent room or a milk-tea interior warehouse that the author explicitly removed. They also cannot be made green by dropping the underlying route/permission/physical behavior.

### Existing identities, seats and real bodies

- `cafeSeating`, `npcFoundation`, `navigationBarrier`, `fixedInteractionAccess`, `npcMovement`: use the current continuous Cafe's actual front-inside point rather than its world's fruit-tea new-game position or old Cafe numeric coordinates. Shared setup is `tests/helpers/currentCafe.ts`; world metrics remain 1920x1080.
- The actual Cafe trial has four two-seat groups/eight seats, not the retired five two-seat plus three four-seat groups. Tests still check staged Lao Zhou occupancy, a free conversation seat, selected-seat prompting, real sit centers, actor self-exclusion, legal seat approaches and release. Four current table groups each have exact character-sized bodies. Both 11px protagonist and 16px person NPC are physically unable to pass the actual 6px gaps; outer routes and live-controller blocking are checked. The old invisible Cafe relation barriers are not restored to imitate a deleted furniture layout. Generic relation tests for the other existing relation furniture remain.
- `commercialCafeStory` and `commercialCafeBehavior` now expect the approved visible avatar `人`, retaining the three original actor IDs, roles and dialogue behavior. Movement fixtures derive body size from the actual scene label through `mainlineNpcLabelFootprint`, matching the already fixed runtime; they no longer register an invisible two-character `店员` body. Ordinary street people remain the six IDs owned by the six actual ambient routes; the two static tea workers are not counted as additional street patrols.
- `mainlineVisualFootprint` and `mainlineSpatialMigration` check the actual 16px world body. A continuous counter run is not an ordinary two-character object: the test verifies the continuous body and null per-glyph collision rather than asserting a second independent body on every glyph. The new Yonghe counter remains 16x256 reference pixels. Cafe's two immutable runs are checked against their visible glyph envelopes under the actual projection scales.

### Original Cafe story/coffee stays attached to one room

- `continuousCafeMigration` uses the current public order marker rather than a retired customer point now inside/against a counter. Old URL/save migration, same-object alias, ordinary continuation and all original story/seat/coffee IDs remain checked.
- `interactionExitSemantics` / `followupExperience`: floor service iterates the three public tables in the Cafe room, not every table in the entire commercial world. Contact expectation uses the actual 16px `人` body and authored service side; routes and legal final contact are retained.
- `mainlineSceneInteractions.test.ts`: the original `commercial-cafe-counter` coffee-order entity remains. The other visible counter letters are inert geometry, so the retired requirement for 17 individually orderable cells becomes one preserved order identity, its legal public contact and the unchanged optional coffee/milk-tea confirmation behavior. Continuous geometry is separately tested over all 43 Cafe counter glyphs/two bodies.
- `followupExperience` distinguishes the current world's ride segment from a raw deprecated Cafe ID; it does not fabricate a separate Cafe scene route. The older ETA assertions still failing are explicitly left in the table below, not silently counted as successful normal travel.

### Authorized layout replacements, not new gameplay

- `commercialStreetShellFurniture` keeps its existing cases but applies current trial data: four Cafe tables/eight seats and two character-built counters; milk-tea has no tables or internal kitchen/warehouse doors, uses its right work line and two non-overlapping counter runs, and preserves menu/order/pickup interaction identities. Current fast-food's two groups/four chairs, 27 partition glyphs, four partition bodies, two real internal openings/signs and routes remain checked. Removed milk-tea fake internal-door IDs are explicitly required to be absent; the actual locked rear door remains.
- `commercialStreetRetailFixtures`: ten unchanged generic retail shells keep their old static one-character fixture, readable counter, storage and circulation checks. Fruit-tea is separately checked as the authorized short-L trial with no seats/indoor storage, two bodies, reachable order/pickup markers, a legally authorized employee and locked rear threshold; it is not falsely required to retain the generic retail counter. No commerce, inventory or NPC business AI was added by these tests.
- `commercialStreetRearWallIntegrity` / `commercialStreetStorefrontInteractions`: keep every front open/routeThrough, every real rear locked, all eleven former extra-door locations plain physical walls without door identity, and all original control stores. A rear approached through a declared employee area is tested with the actual authorized actor; public denial is separately retained. The inside target comes from the actual door's crossing target, not a room center that can now be furniture or staff space. Actual crossing paths declare the front lifecycle open; existing closed-gate/live-travel tests still require that a closed physical door cannot be walked through. No route/open assertion was simply removed.
- `storefrontPresentation`: 14 front + 14 rear passages remain, plus the explicit locked Cafe customer-toilet trial door. It is not silently accepted as an extra front or unlocked exit.

### Retired world and visual coverage contracts

- `font16ApprovedWallTails`, `mainlineFixedWallGlyphGrid`, `sceneGridRollout`: the old independent Cafe's immutable wall hashes cannot remain a live-room contract after its approved removal. Tests require the compatibility alias to be the exact current Street object and the old Cafe room/anchored runs absent. Historical fixtures are retained. Active worlds still receive their full 28px lattice, endpoint/corner/door coverage and current geometry validation. Semantic comparison with the pre-grid fixture remains exact outside the explicitly authorized Cafe/tea/Yonghe layout entities, actors and restored preview interaction copy; dedicated current-layout/story tests cover those changed entities instead of falsely asserting no changes.
- `mainlineGeometrySnapshot`: normal/split/revealed storefront door roles are checked on the actual current door IDs, same-scene Yonghe front, and four now-usable outdoor chairs. The geometry transaction uses the actual fixed reference world while each viewport separately supplies its visible span; a phone's pixel dimensions are no longer incorrectly passed as the world design size. This prevents a spurious phone-body enlargement from making all door contacts unreachable.
- `helpers/wallVisualCoverage`: the physical facade previously excluded real `visualOnly` baseline composition cells, reporting an entire expanded storefront as an empty gap. A shared corner may also be painted by the adjacent store owner, at the exact same coordinate. Both are counted as real paint; unrelated normal coordinates and out-of-span cells are excluded. No distance threshold was widened or distance-band filter introduced. `wallCoverageOwnership.test.ts` removes the exact shared corner glyph and requires the measured missing cap to be detected; a remote glyph on the other edge cannot conceal it.

Small `toBeCloseTo` precision adjustments in current glyph-envelope checks are below 0.005 reference pixels, accounting for the existing four-decimal percentage representation (e.g. 32.00064px). They do not permit a visible missing cell or squeeze a 6px gap. Wall/corner thresholds and the negative missing-corner test remain strict.

## Actual runtime problems found instead of changing assertions

1. **Missing Cafe staff access feedback:** preserved a failing `deniedAccessRegion` assertion, identified absent boundary metadata, added actual bottom/right opening declarations (`ca95603`, 4216). Existing UI text and permissions reused, no furniture geometry change. Parent independently passed its local two-opening check.
2. **New cross-store regression in that correction:** full-contract checks found its right edge rejected unrelated north-store rear areas as an infinite half-plane. This was a real regression, not an obsolete test. `6dc1596` bounds the occupancy contact to the region's depth plus the actual half-body clearance, and adds the five other-store points. 4216 is explicitly superseded and cannot be published. 4217 is frozen separately, with actual desktop/mobile Cafe feedback and creative/fragrance rear walking/locked-door captures. Parent's independent 4217 QA is pending at this report's writing.

Reports: `2026-10-21-cafe-trial-access-feedback.md`, `2026-10-21-bounded-access-region-followup.md`. Mine migration `5cfac1f`/4215 was independently passed and kept unchanged. Its function preserves non-position fields, but normal runtime story clocks/notes can advance; do not claim every runtime field remains byte-for-byte frozen.

## Eleven remaining failures, all recorded on both historical controls

The retained unchanged-027f31 run has 770 tests/18 failures; the A/d00f93c run has 778/17. **Every one of the current eleven failing full names occurs in both prior records.** This is a comparison with existing recorded runs, not a fresh historical checkout run under the rewritten contracts. Evidence `.tmp/final-baseline-failure-comparison.json`; source files are `.tmp/grid-control-all-tests.json` in the original restore worktree and `.tmp/fruit-reset-all-tests.json` in the office worktree. Exact current errors are retained in `.tmp/final-contract-failure-inventory.json`.

| Count | File / remaining contract | Evidence and classification |
| ---: | --- | --- |
| 1 | `commercialStreetAmbientNpcs`: fixed legal patrol routes | **Real inherited route-data issue:** a target x174.0033 lies beyond current east bound x162.9167. NPC simulation/routes were not changed to hide it. |
| 1 | `worldNavigation`: public lane west-to-east | Its literal test points x170/180/190 and target190 are outside that same current bound. This inherited fixture is not proof of a break between two legal in-bounds street points. It is still failed, not counted as a pass. |
| 1 | `p1Experience`: central 30% deadzone/fixed scene | Expects old smooth camera and a fixed standalone Cafe; current camera produces x-6 at the first probe. Inherited camera contract, left unchanged in this batch. |
| 3 | `followupExperience` Office/ETA case; `p1Experience` formal interior ride; `phoneRideRound3` seated Cafe ETA | The two former cases reach the Cafe ETA check and get null; the latter iterates the old Cafe/full-world seat fixture using phone dimensions as world metrics. These inherited API/fixture assumptions still need separate current-flow/ETA verification. Normal travel QA elsewhere does not turn these three tests into passes. |
| 2 | `releasePreparation`: v0.2.1 list and bilingual announcement | Existing data now includes v0.2.2 and changed release copy. Release metadata/announcements were not rewritten to make old snapshots pass. |
| 2 | `worldNavigation`: mining locked passage priority / clicked-slot intent | Old origin and target assumptions around the former separate eatery remain failed (one matches the front before the requested rear; one public threshold target resolves ordinary). The actual locked rear and current door routes are independently covered, but these inherited contracts were not silently deleted or called successful. |
| 1 | `mainlineSceneInteractions`: region label | Expected `矿区`, actual data-driven label `矿区外围老街`; inherited naming expectation, no new canon rename made. |

No new failing full name remains relative to those records. This does not prove all inherited behavior is harmless; particularly patrol data and the ETA cases remain known limitations. No global all-scenes story acceptance or performance improvement is inferred from unit counts.

## Historical Yonghe observation counter investigation

The function was not imaginary: commit `243c007992e997e850e8a3f04ca13c317258e13c` added `yongheSurvey.ts`, Page callbacks, unit tests and desktop/mobile E2E source. Commit `c4e6fbfbacd519c8caa0c56526483cb865044a30` retained the four-point contract while moving observations onto real table/counter/door objects. Both have `git merge-base --is-ancestor <sha> bae6afb` exit **1**, so neither is an ancestor of the current public base. `git ls-files` has no current survey module/Page coordinator. The missing counter therefore predates this B/C work; it was not deleted by the current Cafe cleanup or mine save migration.

Historical persisted keys are `yongheSurveyPoint:tables`, `:counter`, `:central-lane`, `:back-door` plus `yongheSurveyStatus`; arbitrary observation order/partial exit is retained and completion requires all four distinct points. The module explicitly calls its copy preview proposals, not canon. The branch later changed the central observation anchor, so copying the module blindly would also pick an old expression choice.

Current code keeps the four preview interaction meanings/descriptions and preserves all old save-state fields, but **does not currently update the old four-point completion counter**. Central abstract `观察` is still author-pending; no replacement UI, guessed story/achievement or fabricated completion was added. Restoring a coordinator and choosing that observation expression are a separately identified compatibility decision, not reported as completed by this layout trial.

## Delivery boundary

Frozen runtime candidate 4217/6dc1596 remains unchanged during this test-only commit. Its rebuilt JS is byte-identical; HTML/JS/CSS read back HTTP200 with matching bytes/SHA. 4215/5cfac1f remains the independently passed migration package. Author aesthetics, physical devices/Safari, all live plot/ETA paths and final independent 4217 result are not globally accepted here.

Public stays bae6afb. The prior attempt to stop/replace 4173 with the corrected A/860d070 application was denied before execution because auto-review required direct authenticated user authorization for that exact externally visible corrected build. Parent's retry was also denied and the author has not replied. No alternative publication path or new attempt was made. No push/main/staging/Vercel; all QA used isolated saves and browsers are closed. Untracked `.tmp/`, `.codex-test-tmp/` and earlier protected artifacts are retained.
