# Active world grid rollout — isolated candidate, not released

Application: `9ace6ee99ec94f8c8f1cb84990d18078390fda8e` on `preview/office-grid-pilot-20261021`.
Workspace: `E:\小说\NewTone-Workspace\preview-office-grid-pilot-20261021`.
This includes accepted Office visual `787b9d2` and the unchanged published area projection (original `744fbe8`/`027f31b`, local cherry-picks `499233b`/`1d3a49b`). No push or public replacement.

## What the picture does

Every active continuous space has its own origin and exactly 28 reference-pixel wall pitch. Walls no longer retain short compressed tails. Wall, window, door and corner coordinates share that grid. Ordinary text remains16, furniture glyph spacing16, and the existing device projection scales all of them together. Furniture groups move together; their internal dimensions are not stretched. No new interior design or story is included.

| Space / IDs | Wall-center extent before → after, reference px |
| --- | --- |
| Yard / jijia-ancestral-home | 1728×691.2 →1736×700 |
| Interior / jijia-ancestral-interior | 1728×691.2 →1736×700 |
| Passage / zhongshuyuan-passage | 1804.8×112.00032 →1820×112 |
| Office / zhongshuyuan-office | 1689.6×907.2 →1792×924; accepted pilot retained |
| Commercial continuous14 shops | 2743.93728×1758.40416 →2744×1764 |
| Mining continuous8 shops / yonghe-mining-perimeter and yonghe-eatery | 559.9872×1344.00492 →560×1344; same configuration |

The old standalone commercial-cafe is excluded. Redirecting its URL/old saves into the continuous Cafe, then removing its implementation, remains a separate cleanup batch. Its geometry has not been migrated or deleted here.

## Actual code and why

`sceneGridRollout.ts/sceneGridTransform, alignSceneBlueprint` use the surveyed primary wall planes. Each band rounds outward to an integer number of28 intervals, with0.1 reference px tolerance for old authoring-rounding noise. This avoids treating a28.0004 span as two cells. Wall endpoints snap to one origin; openings retain a whole-cell interval and aligned center. Windows/glass use the same origin. Wall-owned room bounds reuse the actual snapped shell bounds, avoiding floating-point differences at exact facade clicks.

```ts
// Before: each structure fitted its own segment or compressed its last intervals.
// After: one world origin, common pitch, explicit geometry metadata.
mapped.push(mapped[i-1] + Math.ceil((oldPlane[i]-oldPlane[i-1]-.1)/28)*28)
boundaryWorldGrid: { origin: grid.origin, pitchPx: 28 }
// Furniture is translated as a group, not re-spaced.
translate(entity, { x: nextAnchor.x-oldAnchor.x, y: nextAnchor.y-oldAnchor.y })
```

The same map updates room/collision/air-wall/access-region geometry, NPC placement and route coordinates, external-exit thresholds, storefront ownership ranges, player spawn and ride arrival. NPC simulation is unchanged. Area-label functions read the inverse map so their original spatial labels still follow the moved areas. Cross-scene `entryPosition` is resolved from the destination's matching reverse-door threshold after every blueprint has been transformed.

`playerSave.ts/sanitizePlayerSave` adds a separate `worldGridVersion:1` marker. Existing save-version2 phone semantics remain unchanged. Unmarked current and remembered positions map once, piecewise within their former rooms; story state, inventory-like scene fields, phone, contacts and notes remain. New games already start on the new geometry. Legacy pre-unified position records also enter that migration. No real browser save was accessed.

```ts
if (source.worldGridVersion !== 1) {
  scenePositions[id] = migratePreGridPosition(id, oldPosition)
}
// Output stores worldGridVersion:1; sanitizing it again does not migrate twice.
```

`mainlineNavigation.ts/resolveMainlineSafeSpawnPosition`: a walkable restored point in a grid room is accepted even when its route to the global initial spawn would cross a locked door. A blocked point searches only inside that same room; it returns null if there is no valid candidate. It does not use another room as a fallback. Ordinary path planning and door authorization are unchanged.

The17-file app commit includes4353 lines of semantic fixture captured from the unchanged027f31 control, rather than regenerating expected state from the new code. Tests compare object IDs/labels/roles, room graph, portal permissions/targets and story text. Old tests that required *physical* geometry to stay byte-identical applied to the previous visual-only patch and are now scoped to the excluded legacy Cafe; exact active lattice and owned-edge coverage replace those obsolete requirements. The11 former extra-door controls are mapped into the new lattice and still require ordinary wall identity, collision and ordinary click behavior. A tiny furniture-local difference below0.02 reference px from old rounded28 pitch is tested at0.001-cell precision while internal16 glyph geometry is left intact.

Full actual code diff: `git show 9ace6ee`; prototype and final evidence are preserved under `.tmp/` and are not staged.

## Tests and actual browser evidence

- Typecheck passes; isolated Vite build passes (existing >500kB bundle advisory).
- Targeted10 files: **131/131 pass** (`.tmp/grid-target-tests.json`).
- Final whole-suite run: **753/770 pass,17 fail** (`.tmp/grid-final-all-tests.json`). This is **not a green full suite**. Every remaining failure reproduces on unchanged027f31 control (`.tmp/grid-control-all-tests.json` in original worktree:752/770 pass,18 fail). No newly failing test remains in the comparison; changes in total represent replacement of obsolete physical/tail assertions by new semantic/lattice checks.
- Remaining failures include old standalone Cafe service/ride assumptions, obsolete Yonghe objects and geometry/labels, old viewport contracts, release-announcement snapshots, street test targets beyond current world bounds and two old mining door-intent assumptions. The ambient route test also exposes two pre-existing street patrol targets beyond the present east bound. These are recorded, not silently fixed by changing NPC simulation or accepting failed assertions.
- Actual Chrome1920×1080, DSF1: all7 active scene IDs open on old4187 and new4191 with no page errors. Same scale1 and font16;14 raw screenshots and DOM evidence in `.tmp/grid-render-final/`. Office remains the accepted pilot picture; other scenes have not received author aesthetic acceptance.
- Isolated old-save desktop1280×800 and phone390×844 checks cover Office locked-room occupant and street position, click movement, persistence and preserved story/contact fields. Script seeds only once per context, so refresh does not overwrite the tested save (`.tmp/grid-old-save-smoke.json`).
- Not yet done: independent final navigation/door/frame QA across all affected scenes, physical phones/Safari, full live story progression and author review of every scene. No new FPS/performance conclusion is made.

## Frozen candidate

`http://127.0.0.1:4191/` (PID47864), output `.tmp/grid-batch-review-dist`. Old Office4189 and first batch4190 remain unchanged.

| File | bytes | SHA256 |
| --- | ---: | --- |
| index-BHgpXn3C.js |840220|849a755cc45d7a9aff5302fc9985e39934082af58d19a05db2734ac066ba7044|
| index-BsDrr4lS.css |200381|67dbb36fb235e8f7493fda38992e06ed6f9b88cfb724e7b928fefe6c4aa5664e|

HTML and all four referenced assets read back HTTP200, exact byte/SHA match (`.tmp/grid-review-http.json`). Normal sandbox localhost access returned EACCES; the authorized read-only escalated check succeeded. No outstanding permission denial.

Public4173/QuickTunnel remains027f31. No push/main/staging/Vercel or real save modification. Candidate is ready for independent QA; known baseline failures and untested items prevent calling this full acceptance or publishing it now.

## Follow-up: one first-shop entrance for new games, restart and taxi

Application commit **bae6afb20ce8955d4e3a25a30f008b49e76c4197** follows the batch grid candidate. Parent confirmed normal taxi arrival on027f31 was `(34,50)`, horizontally near the second shop. Author explicitly requires both new-game birth and taxi arrival at the first fruit-tea shop's public road; ordinary continuation keeps its saved location.

### Actual code diff and paths

Only `mainlineSceneModel.ts` runtime data changed (20 additions/1 deletion), plus47 lines of new `tests/commercialStreetEntrance.test.ts`:

```diff
- initialPlayerPosition: authoredPoint(34, 50),
+ initialPlayerPosition: commercialStreetEntrance,
+ rideArrivalPosition: commercialStreetEntrance,
```

The authored entrance uses the first storefront's portal tangent and the midpoint between north/south facades. After `alignSceneBlueprint` has produced the actual grid geometry, the final entrance is resolved from that first portal and its public room, rather than copying an old numeric x:

```ts
const entrancePortal = alignedStreet.portals.find(portal => portal.id === commercialStreetStorefronts[0]!.portalId)!
const entranceLane = alignedStreet.scene.rooms!.find(room => room.id === entrancePortal.fromRoomId)!
const alignedStreetEntrance = {
  x: entrancePortal.endpoint.doorPosition.x,
  y: entranceLane.bounds.y + entranceLane.bounds.height / 2,
}
alignedStreet.scene.initialPlayerPosition = alignedStreetEntrance
alignedStreet.scene.rideArrivalPosition = alignedStreetEntrance
```

Result: **(22.2083333333,50.2590666667)**, first fruit-tea frontage/public-road center. No door, room, wall, furniture, navigation algorithm or scale changed by this follow-up.

- Missing save/new game: paired default remains commercial-street+inner phone; `currentPosition:null` makes `MainlineScenePage.initialPositionForEntry` select this scene entrance.
- Explicit restart: existing `clearPlayerSave` removes current/legacy coordinates; subsequent normal Landing entry takes the same initial path. No new automatic reset is added.
- Normal taxi: existing `CenterExperience.handleSceneTransition` and Page `spawnMode==='ride'` select the now-explicit `rideArrivalPosition`, overriding a remembered street location only for that trip.
- Ordinary continuation: Page still selects `resumePosition`; neither save sanitization nor grid migration was changed here. Test-grid marker1 positions remain exactly as saved. Older unmarked positions still receive only the previously documented one-time geometry migration.
- Explicit test URLs/explicit entry positions retain their existing semantics; not repurposed as forced new-game birth.

### Validation and frozen replacement QA candidate

- **4 existing test files /32 tests pass**, including6 new entrance cases,13 batch-grid cases,8 paired-initial-state cases and5 street-camera cases (`.tmp/entrance-tests.json`). The command also named nonexistent `tests/playerSave.test.ts`; Vitest did not run that name, and it is not counted as coverage.
- TypeScript `tsc --noEmit`, isolated Vite build and `git diff --check` pass. Only the existing large-chunk advisory remains. Whole-suite753/770 with17 control-reproduced failures above was not rerun for this two-file entrance follow-up; it remains an explicit limitation, not a green full-suite claim.
- Actual fresh Chrome/DSF1 at1280x800 and390x844: normal Landing entry, isolated restart, and normal Office phone buttons (open phone -> ride -> commercial street -> vehicle -> confirm) all reach the exact entrance and camera page one. Office test starts at its real pickup exit; no order, boarding callback or street route is injected.
- New-game/taxi arrivals accept a real click on nearby public road; refresh retains the walked position. Separate ordinary continuation at(80,50) retains that point across refresh, plus Cafe completion and contact note. Six contexts have no page errors. Screenshot/DOM/save evidence: `.tmp/entrance-browser/results.json` and six PNGs. Restart browser smoke mirrors only `clearPlayerSave` keys inside its own fresh context; the real clearing function is separately unit-tested. No user browser storage was accessed.
- Initial exploratory browser runs clicked before the Landing/travel curtain finished; these were not recorded as successful walking tests. Final evidence waits for transitions to finish. The continuation check does not claim a road click through the phone overlay as navigation evidence.

**New frozen candidate: http://127.0.0.1:4192/**, PID47012, output `.tmp/grid-entrance-review-dist`. Application SHAbae6afb above.4191 remains unchanged for comparison.

| File | bytes | SHA256 |
| --- | ---: | --- |
| index-4KS_-7ar.js |840516|bb3d95f51d47ea9c22b89c1d9792ad52e2c27b040d48dd78805183ed7dfccae6|
| index-BsDrr4lS.css |200381|67dbb36fb235e8f7493fda38992e06ed6f9b88cfb724e7b928fefe6c4aa5664e|

HTML and all four referenced assets read back HTTP200 with matching bytes/SHA (`.tmp/entrance-review-http.json`). Browser processes closed after checks. Public4173/QuickTunnel stays027f31; no push or publication. Ready for combined independent QA, not overall acceptance. Physical devices/Safari, full story and inherited baseline failures remain as listed above.
