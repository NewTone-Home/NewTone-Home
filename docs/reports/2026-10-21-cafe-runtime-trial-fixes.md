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
