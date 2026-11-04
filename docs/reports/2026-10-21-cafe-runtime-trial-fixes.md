# Cafe trial runtime follow-ups — one issue per frozen candidate

## 1. Released Lao Zhou chair can actually be selected

### Proven mismatch and minimal fix

The Page already computes `releasedCafeSeatNpcIds` and `occupiedSeatIds` from live departure state. Renderer and navigation use that set. However, its chair click called `nextMainlinePlayerSeatId`, which called `isMainlineSeatAvailable` and rebuilt occupancy from initial NPC staging. It therefore reserved Lao Zhou's original seat again after he had left. This is an input decision mismatch, not a hidden chair, route permission or furniture collision problem.

`mainlineSeating.ts/isMainlineSeatAvailable` and `nextMainlinePlayerSeatId` now accept an optional occupied-seat set. Their default preserves initial-staging semantics for older callers; the Page passes its actual live `occupiedSeatIds` and subscribes the callback to that set. Unknown/non-seat objects and currently occupied seats remain rejected. No NPC departure, navigation, rendering, geometry, story line, player save or door permission change.

`tests/runtimeSeatRelease.test.ts` proves the same actual chair is unavailable while occupied, available with the released live set, still protected from another occupant, and cleared on standing. An expanded run exposed one hardcoded chair coordinate in `continuousCafeRenderedDeparture.test.tsx`, inherited from the earlier three-table layout. The assertion now requires the current geometry snapshot's actual chair centre, retaining the rendered-seat anchor and departure checks rather than deleting them. Initial expanded result10/11 is not represented as passed; final rerun11/11 passes. Typecheck/build/diff-check pass, existing chunk advisory remains.

### Actual browser result

Candidate **http://127.0.0.1:4212/?scene=commercial-street**, frozen `.tmp/runtime-seat-release-dist`. An isolated save starts the already completed narrative with Lao Zhou in the existing walking-out state, not injected movement. Chrome1920×1300 waits until he really disappears through the existing departure flow. Then normal click on his original `commercial-cafe-right-window-upper-group-chair-top` seats the player; normal central-floor click stands and walks away; refresh and another click seats the player there again. Both seated observations show the actual `data-seat-entity-id`, Lao Zhou remains absent, no pageerrors, browser closed. `.tmp/runtime-seat-release-browser/results.json` and departed/original-seat-seated/standing/refresh-seated PNGs contain the evidence. This is one actual browser size, not mobile/Safari or a whole-story walkthrough.

JS `index-CyAhxLDt.js`850518bytes/SHA256 `fbc23c0347e720864eeafefaae19513d692d08740a4f30f6e80b65400e4f0ef6`; CSS `index-CGh3wNIs.css`200573bytes/SHA256 `2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039`. HTML/main JS readbackHTTP200 and bytes/SHA match. CSS unchanged from4211.

### Next issue diagnosed, NOT fixed in4212

The blocked `cafe-floor-server` has a separate proven footprint mismatch. `commercialCafeFloorServiceTarget` resolves the table contact from the current scene label 人,16px wide. `MainlineScenePage` still creates the movement adapter body from the hardcoded label 店员,32px wide (also hardcodes the two other Cafe role labels). With the actual dynamic registry and the same target(140.4816667,-13.25945185), `.tmp/floor-service-footprint-diagnosis.mjs/.json` proves:

- From(135.9583333,20.44425185),16px body: contact legal, non-null path.
- Same world/actors/target,32px body: contact illegal, null path.

The32px body overlaps the table edge where the16px contact keeps the normal shared gap. No layout or obstacle removal is needed. Next narrow fix should use the same actual scene label footprint for Page actor registration and contact/navigation resolution, keeping original role IDs/story names. This is aligning collision with the visible character, not inventing a smaller actor. It remains unfixed in this seat-only candidate so independent QA can isolate the two changes.

## Remaining restrictions

No public replacement or push. A publication denial remains unresolved; publicbae6afb and old review ports remain unchanged. Cafe service/whole narrative, mine room-identity migration, B contracts and Yonghe survey counting remain pending. Tea layout review changes are still queued, not silently included.

## 2. Floor-server movement uses the same visible-label footprint as its contact

### Root cause established before editing

The exact same world, static geometry, live actor registry and target were tested in `.tmp/floor-service-footprint-diagnosis.mjs/.json`. The table service resolver already derived its body from `scene.npcs[].label` (the trial's visible 人) and returned a16px-body contact. Page actor registration independently hardcoded 店员, giving the movement adapter a32px-wide body. At(140.4816667,-13.25945185), that32px body overlaps the table edge, so requestMove reports blocked before moving. The16px body is legal and has a path. The ordinary service contact gap remains unchanged. This is not a collision-size guess or proof based only on a static path.

### Actual fix and scope

- `sceneLayout.ts/mainlineNpcLabelFootprint` is a small shared derivation from the existing scene NPC's actual rendered label, existing16font/lineHeight1, and the existing scene projection. It returns the same character box used by navigation; it does not change labels, roles, fonts or layout.
- `mainlineNavigation.ts/mainlineActorFootprint` delegates its previously equivalent NPC-label expression to that helper. Explicit footprint/radius callers and protagonist behavior remain unchanged.
- `MainlineScenePage.tsx` computes coffee-owner, floor-server and Lao Zhou movement bodies using that same helper instead of three hardcoded role-name strings. These actors are all currently drawn as 人 in the author-review layout, so actual registration is16px, matching their contact resolver. A scene that actually displays 店员 or 老周 still receives32px. No identity, speaker name, story state machine, actor removal, furniture obstacle, access region, passage permission or movement speed changes.

`tests/cafeRuntimeLabelFootprint.test.ts` reproduces the32px rejection, runs the real `createNpcMovementAdapter`/free-roam controller with a live registry and16px body to the same contact, checks every sampled actor point remains walkable, confirms the registered body and real arrival callback, and protects32px when a scene really draws a two-character label. Together with runtime seat and layout checks:9/9; typecheck/build/diff-check pass. This does not imply the old full-suite fixture contracts are migrated.

### Actual final browser evidence, combined with seat release

Frozen **http://127.0.0.1:4213/?scene=commercial-street**, `.tmp/cafe-label-body-dist`. Stage1/4212 stays unchanged. New and completed-story isolated saves each run12seconds in actual Chrome1920×1300. `cafe-floor-server` has74/87 distinct visible positions, phasesmoving/idle and service stateserving/dwelling. In both runs it really stops at all three public-table contacts:

- (140.482,-13.2595)
- (147.773,-13.2595)
- (147.773,10.0739)

No blocked state or pageerror in those sampled windows. `.tmp/cafe-label-body-browser/results.json` plus fresh/complete PNGs preserve every50ms sample. Counts are functional trajectory evidence, not FPS/performance statistics. Browser closed.

A second sequential isolated context on4213 waits for Lao Zhou's actual existing walk-out/disappearance, then normally clicks his original chair, stands/walks out, refreshes, and sits there again. Seat attributes match and no pageerrors. `.tmp/cafe-label-body-release-browser/results.json`/4PNGs. This confirms the two fixes together for this path; it is not a full narrative/coffee delivery replay or mobile acceptance.

Resources: JS `index-CN7dGcVm.js`850549bytes/SHA256 `416cabeed27614752f7f573cf0587819bcddf3677554f2c5e79edd692e76e089`; CSS `index-CGh3wNIs.css`200573bytes/SHA256 `2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039`. HTML and both resources read backHTTP200 with matching bytes/SHA. No push/public release or replacement of frozen review builds.

### Yonghe central label clarification, no change yet

The visible 观察 at the centre of4211 is **normal player-visible text**, not a debug overlay. It comes from the historical central-lane observation landmark, restored in `yongheInteriorTrial.ts` under `yonghe-survey-central-lane`; the longer historical label通道观察 was shortened to观察. That still presents an abstract observation as a floor object, contrary to the author's stated preference. No further change has been made while the reviewed4211 image stays frozen.

Suggested smallest expression change: retain the stable semantic ID, original observation copy and saved survey fields, remove the world-space text, and expose an explicit 查看周围 action through the existing outside-world interaction UI while near a legal central point. It must not add an invisible collision object or automatically mark the observation complete merely by walking past. The precise existing-UI entry remains to confirm; no new gesture, survey count or narrative has been implemented under this suggestion. The already missing historical survey coordinator remains a separate compatibility item.
