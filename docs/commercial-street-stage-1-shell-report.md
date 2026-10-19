# Commercial Street Stage 1: Empty Storefront Shells

## Scope and state

This stage implements two empty, walkable shop shells in the existing `commercial-street` scene:

- North N2, `commercial-north-slot-2` (11 character cells wide).
- South S2, `commercial-south-slot-2` (the 23-cell fast-food double bay).

Both entry portals have no `targetSceneId`: passage lifecycle crosses the facade in the existing world coordinates. The Cafe scene, its story and save keys are unchanged. No other shop entrance was opened. Rear doors are authored as locked passages with no destination. The storefront facade, glyph arrangement, door locations, storefront order and lane arrangement are unchanged.

## Grid dimensions and ownership

The implementation uses `boundaryGridStepsFromScreenSpacing()` for both axes. At the standard 1280 x 720 screen metrics, a character pitch is 2.1875% horizontally and 3.8889% vertically. The facade contains 11 and 23 horizontal character centers for N2 and S2. Each shell pins compiled frame coordinates to those same anchors: rear edges have 11/23 anchors and side edges have 22 anchors including both ends. The 22 centers are 21 vertical pitch intervals between the existing facade center and rear-wall center, so the depth is `verticalPitch * 21` (about 81.67 stage units). N2 runs north from its existing facade; S2 runs south. The existing facade is the room front wall and is not recreated by either shell.

Shell corners use the first and last frozen storefront glyph centers. The rear row therefore aligns with the facade at 1280x720, 1180x757, and 390x844 instead of overhanging by half a cell. Room bounds and portal positions stay at their authored world coordinates across screen metrics. The side rows include the rear endpoint and meet the existing facade at the front endpoint; the facade owns that shared front glyph visually. Each shell adds only left, right and rear boundary edges. The rear edge contains the locked rear-door opening. The sample room bounds are registered in `scene.rooms` and linked bidirectionally to the public lane using `routeThrough` passages. The larger y walk bounds let the same scene camera and navmesh reach the rooms. Segmented air walls preserve the established off-storefront barriers and close the new north/south extension everywhere except the two authored bay spans. Thus the expansion does not make unselected store backs walkable.

Historical implementation note (corrected by the room-transition stability update below): shell wall glyphs were initially filtered at the renderer by the active room. Although compiled geometry, collision and navigation remained present, this changed the visual glyph set on each doorway crossing.

## Changed files and source evidence

### `src/center/runtime/mainlineSceneModel.ts`

Adds measured room spans, shell-owned air-wall cuts, open sample-entry passages, locked rear doors, room bounds and side/rear walls. The exterior wall remains the only front wall.

Previous exterior-only barrier and locked entry behavior:

```ts
const commercialStreetFacadeAirWalls: readonly MainlineAirWall[] = [
  { id: 'commercial-north-facade-air-wall', ...box(8, 10, commercialStreetWorldRight - 8, 25.3 - commercialStreetLaneExpansion) },
  { id: 'commercial-south-facade-air-wall-left', ...box(8, 64.7 + commercialStreetLaneExpansion, 180 + commercialStreetLongitudinalExpansion, 25.3 - commercialStreetLaneExpansion) },
]
// ...
wallOpenings: [], transitionText: '此店铺尚未开放。', access: 'locked', lockedText: '此店铺尚未开放。'
// ...
walkBounds: box(8, 10, commercialStreetWorldRight - 8, 80),
```

Current grid and shell span:

```ts
const commercialStreetInteriorVerticalCoordinateCount = 22
const commercialStreetInteriorDepth = boundaryGridStepsFromScreenSpacing().vertical * (commercialStreetInteriorVerticalCoordinateCount - 1)
const commercialStreetFacadeNorthY = 14 + 22 - commercialStreetLaneExpansion
const commercialStreetFacadeSouthY = 64 + commercialStreetLaneExpansion
const commercialStreetInteriorSamples = [
  { storefrontId: 'commercial-north-slot-2', roomId: 'commercial-north-n2-interior', side: 'north' as const, horizontalCellCount: 11 },
  { storefrontId: 'commercial-south-slot-2', roomId: 'commercial-south-s2-interior', side: 'south' as const, horizontalCellCount: 23 },
].map((sample) => {
  const storefront = commercialStreetStorefronts.find((candidate) => candidate.id === sample.storefrontId)!
  const facade = sample.side === 'north' ? commercialStreetFacadeNorthY : commercialStreetFacadeSouthY
  const back = facade + (sample.side === 'north' ? -commercialStreetInteriorDepth : commercialStreetInteriorDepth)
  const x = storefront.start + commercialStreetCellPitch / 2
  return { ...sample, storefront, facade, back, x, width: storefront.end - storefront.start - commercialStreetCellPitch }
})
// Each sample shell structure uses:
boundaryCoordinateCount: {
  horizontal: sample.horizontalCellCount,
  vertical: commercialStreetInteriorVerticalCoordinateCount,
}
```

The air-wall helper subtracts exactly each sample bay interval from its source barrier, then the extension bands prevent the expanded walk bounds opening the remaining shop backs:

```ts
const commercialStreetAirWallSegments = (id: string, bounds: CollisionBox, samples: typeof commercialStreetInteriorSamples) => {
  const cuts = samples.map(({ x, width }) => ({ start: x, end: x + width }))
    .filter(({ start, end }) => end > bounds.x && start < bounds.x + bounds.width)
    .sort((left, right) => left.start - right.start)
  const segments: MainlineAirWall[] = []
  let cursor = bounds.x
  cuts.forEach(({ start, end }, index) => {
    const clippedStart = Math.max(bounds.x, start)
    const clippedEnd = Math.min(bounds.x + bounds.width, end)
    if (clippedStart > cursor) segments.push({ id: `${id}-${index}-left`, ...box(cursor, bounds.y, clippedStart - cursor, bounds.height) })
    cursor = Math.max(cursor, clippedEnd)
  })
  if (cursor < bounds.x + bounds.width) segments.push({ id: `${id}-right`, ...box(cursor, bounds.y, bounds.x + bounds.width - cursor, bounds.height) })
  return segments
}
const commercialStreetFacadeAirWalls: readonly MainlineAirWall[] = [
  ...commercialStreetAirWallSegments('commercial-north-facade-air-wall', box(8, 10, commercialStreetWorldRight - 8, 25.3 - commercialStreetLaneExpansion), commercialStreetInteriorSamples.filter((sample) => sample.side === 'north')),
  ...commercialStreetAirWallSegments('commercial-south-facade-air-wall-left', box(8, 64.7 + commercialStreetLaneExpansion, 180 + commercialStreetLongitudinalExpansion, 25.3 - commercialStreetLaneExpansion), commercialStreetInteriorSamples.filter((sample) => sample.side === 'south')),
  ...commercialStreetAirWallSegments('commercial-north-shell-extension-air-wall', box(8, -56, commercialStreetWorldRight - 8, 66), commercialStreetInteriorSamples.filter((sample) => sample.side === 'north')),
  ...commercialStreetAirWallSegments('commercial-south-shell-extension-air-wall', box(8, 90, commercialStreetWorldRight - 8, 66), commercialStreetInteriorSamples.filter((sample) => sample.side === 'south')),
]
```

## Stage 2: all fourteen empty storefront shells

Stage 1 opened only N2 and S2; this Stage 2 update extends same-scene empty shells to all 14 existing storefronts. It does not add furniture, interior activity, or Cafe story interactions. All storefront fronts now lead to their shell using `routeThrough` passages in `commercial-street`; all 14 rear doors remain locked and have no destination. The old `commercial-cafe` scene blueprint, persistent keys, story content, dialogue cursor, and NPCs remain available unchanged. Entering the street Cafe shell does not load that scene or trigger its plot.

The player-facing street subtitle, hint, and Cafe-entry interaction copy now state that the Preview contains 14 enterable empty shells, the old Cafe contents are still awaiting migration, and the Cafe street door enters only its current shell. The legacy Cafe scene implementation remains intact.

The storefront order, facade labels, authored grid, door coordinates, and 14 merchant identities remain unchanged. Width comes from each storefront's authored `fixedCellCount` (11 centers for a regular bay, 23 for a two-bay unit). Every room is 22 vertical centers / 21 pitch intervals deep. The two-bay units keep the original double-bay footprint and separator; no storefront characters, font size, or pitch were compressed. Room IDs preserve the earlier N2/S2 IDs; other ordinary slots derive from their existing slot IDs, and Cafe uses `commercial-north-cafe-interior`.

The facade owns each shell's front corners and the shell's rear edge owns its back corners; the side runs omit both endpoint glyphs. The geometry test checks compiled visible glyph coordinates for duplicate ownership at all three viewports, including the touching facade corner.

### Source change: generated room and portal inventory

Before Stage 2, shell selection was a fixed two-room list:

```ts
const commercialStreetInteriorSamples = [
  { storefrontId: 'commercial-north-slot-2', roomId: 'commercial-north-n2-interior', side: 'north' as const, horizontalCellCount: 11 },
  { storefrontId: 'commercial-south-slot-2', roomId: 'commercial-south-s2-interior', side: 'south' as const, horizontalCellCount: 23 },
].map((sample) => {
```

Now the same room/portal generation derives every shell from the frozen storefront model:

```ts
const commercialStreetInteriorSamples = commercialStreetStorefronts.map((storefront) => {
  const side = storefront.edge === 'bottom' ? 'north' as const : 'south' as const
  const slotNumber = storefront.id.match(/-slot-(\d+)$/)?.[1]
  if (storefront.id !== 'commercial-cafe-slot' && !slotNumber) {
    throw new Error(`Commercial storefront ${storefront.id} must keep its numbered slot ID`)
  }
  const roomId = storefront.id === 'commercial-cafe-slot'
    ? 'commercial-north-cafe-interior'
    : `commercial-${side}-${side === 'north' ? 'n' : 's'}${slotNumber}-interior`
  const horizontalCellCount = storefront.composition?.fixedCellCount
    ?? storefront.composition?.baseline.length
    ?? 0
```

The existing open/locked route distinction is expressed by whether a storefront has a generated shell. For Stage 2 all 14 fronts map to their shell while rear doors remain locked:

```ts
const interior = commercialStreetInteriorSamples.find((sample) => sample.storefrontId === storefront.id)
return { id: portalId,
  entity: { id: portalId, label: '门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'double', openLeaves: 'both' } },
  endpoint: { doorPosition: authoredPoint(x, y), threshold: authoredPoint(x, laneY), crossingTarget: authoredPoint(x, laneY) },
  wallOpenings: [], transitionText: '此店铺尚未开放。', access: interior ? 'open' : 'locked',
  ...(interior ? { routeThrough: true, fromRoomId: 'commercial-street-public-lane', toRoomId: interior.roomId } : {}),
  ...(!interior ? { lockedText: '此店铺尚未开放。' } : {}) }
```

Each shell still owns only its sides and back, sharing the existing front facade and common glyph-center lattice. Segmented air walls remove only the shell spans from the lane/back barriers; the surrounding barriers and extension bands keep the street continuous without opening unrelated storefront backs. No room creates a new scene transition or moves the facade/camera coordinates.

### Verification

- Focused Vitest: storefront presentation, all-shell interactions/navigation, and player-contact coverage — 47 passed.
- The initial east-boundary assertion still looked up the pre-segmentation single air-wall ID. The shell openings split that barrier into segments, so the assertion now compares the easternmost endpoint across those segments; the facade span and storefront coordinates were not changed to satisfy the test.
- Navigation checks cover all 14 public-lane-to-approach routes, front-door crossings, paths into each room, and paths to each locked rear-door threshold.
- A read-only boundary comparison against 6556 found the observed east-end position `(229.592, 88.629)` was already inside the frozen walk bounds (`x <= 234.375`, `10 <= y <= 90`) and beyond the old south air-wall end (`x = 222.375`). Stage 2 extends walk bounds vertically to `-56..156`, while the added south extension wall starts at `y=90`; that specific point was not newly opened by Stage 2. The old east-end exterior strip remains a separate pre-existing boundary question; no air-wall or walk-bound layout change was made in this copy correction.
- `npm run typecheck` — passed.
- `npm run build` — passed; Vite emitted the existing large-chunk advisory.
- The first Playwright all-14 traversal attempt produced no result and was stopped; no screenshots were captured. A later script review found two E2E defects: the storefront-label test referenced `stage` after its local declaration had been removed, and the all-shell test issued one coordinate click to the authored approach instead of stepping the actor there. The contact-resilience test now declares its stage locator locally. The all-shell traversal now moves through on-screen 8-unit waypoints, waits for each real actor position, walks to each interior center and back to the inside door threshold before clicking to exit. This is input-driven walking, not teleportation. The fixed E2E scripts have not yet been rerun in a live browser; do not treat them as passed.
- Existing `phone-v1-round3` and `p1-experience` screenshot-producing flows were not run. The Cafe route assertions in the related compatibility specs were updated to enter the new shell before explicitly addressing the preserved legacy Cafe scene.
- At the original Stage 2 cut, performance was not profiled; the room-transition stability update below adds a same-device baseline profile and explicitly separates measured observations from component-level attribution.

The committed Stage 2 code, tests, and full source comparison were linked from the accompanying Notion review note after its preview deployment was verified.

## Room-transition stability update

### What changed

- `src/center/runtime/mainlineSceneVisibility.ts` keeps every `commercial-street` shell geometry unit eligible independent of active room, then culls individual glyphs only when their camera-translated world position is outside the viewport plus 5% text overscan. Other scenes retain their prior shell ownership filter.
- `src/center/runtime/MainlineSceneRenderer.tsx` uses that policy for the visual geometry list. Room furniture remains gated by `mainlineEntityBelongsToActiveRoom`; the scene geometry snapshot, collision, passages and walk graph are not conditionally removed.
- `src/center/runtime/storefrontPresentation.ts` only selects a near-sign owner while the player is within `commercial-street-public-lane`.
- `src/center/runtime/useStorefrontPresentation.ts` restores all sign phases to baseline immediately when the player is within a shop room, avoiding the leave linger from leaving the public lane.
- `tests/mainlineSceneVisibility.test.ts` checks that all 14 shell owners remain scene-owned across lane/N2/S5 ownership, viewport-only glyph culling, and that a S5 fixture remains visible only in S5. `tests/storefrontPresentation.test.ts` checks public-lane sign ownership and no owner inside a shop.
- `scripts/profile-commercial-street-door.mjs` records page-clock `PerformanceObserver` long tasks, request-animation-frame deltas, DOM/shell snapshots and a CDP timeline trace. It captures no screenshots.

### Before/after evidence

Same-device baseline was measured against the 1180x757, scale-1 `commercial-street` preview before this change. Entering N1 changed wall glyphs from 198 to 249 and total DOM nodes from 628 to 760; returning changed them back to 198 and 627. Shop objects changed 0 -> 13 -> 0. The local sample recorded three long tasks during the approach/entry interval (225, 310, 116 ms) and three during return (196, 307, 67 ms). Those intervals include walking and door presentation, so the measurements do not attribute the delay to one component. The trace/profile does not provide a verified per-frame CPU cause.

The first persistent-shell Preview (f621d9d) measured 936 wall glyphs and 42 focus groups outside and inside, with furniture 0/13/0. That showed the geometry was present but also revealed unnecessary offscreen DOM, prompting the viewport-only cull below. This intermediate result is not the final implementation.

On the final Preview (9d5b726), the same Chrome 155.0.8059.80 profile at 1180x757 scale 1 measured wall glyphs 306/310/310, focus groups 28/28/28, DOM nodes 844/877/851, and room objects 0/13/0. The wall count depends on the camera viewport while moving; it no longer depends on active room, and the test asserts all 14 shell owner IDs remain scene-owned. Entry interval: 960.4 ms from input to room items mounted, rAF p50 16.7 ms / p95 200 ms / max 333.3 ms, two >32 ms deltas, with 221/304/523 ms LongTasks. Return interval: 317.4 ms, rAF p50 16.7 ms / p95 and max 16.8 ms, zero >32 ms deltas and no LongTasks. The same-script baseline at exact SHA bce0b1c had wall glyphs 198/249/198, focus groups 28/29/28, DOM 628/760/627 and objects 0/13/0; entry was 1074.3 ms with rAF p50 16.7 ms / p95 216.7 ms / max 316.6 ms and LongTasks 223/307/116 ms; return was 707.1 ms with p95/max 333.3 ms and LongTasks 199/322/64 ms.

These are single-path, one-run observations, not a repeated benchmark or FPS result. Entry still has long app-JS tasks. Chrome traces show long `FunctionCall` events in the minified app bundle on both baseline and final, but the sampled function/source is not resolved; no camera, NPC or component root cause is asserted. The f621 intermediate build also had 227/346 ms entry tasks and no return tasks; because the input path, camera and actor timing can vary, this does not establish causality or a general performance win. The final focused Vitest run passes 50 tests across four files; full 14-store browser E2E was not rerun, and no screenshots were captured.

### Preview and commit

- Branch: `preview/commercial-street-restore-20261019`
- Final runtime commit: `9d5b72695abb74f8724e8adecca25a1c7d5160e1`
- Vercel `new-tone`: **READY**, exact branch/SHA; [fixed Preview](https://new-tone-cdjnkg8q3-newtone-homes-projects.vercel.app)
- Commit source: [9d5b726](https://github.com/NewTone-Home/NewTone-Home/commit/9d5b72695abb74f8724e8adecca25a1c7d5160e1); [baseline-to-runtime diff](https://github.com/NewTone-Home/NewTone-Home/compare/bce0b1c9b1f4a9069a581177dbdf1378f0ae9ec1...9d5b72695abb74f8724e8adecca25a1c7d5160e1)
- Local `npm run build` (typecheck + Vite build) and Vercel build passed. The existing >500 kB main bundle warning remains.

### Focused code delta

Before, the renderer selected shell cells by `activeShellRoomId`:

```ts
const renderedGeometryCells = useMemo(() => geometryCells.filter(({ unit }) => {
  const shellRoomId = unit.sourceWallId?.endsWith('-shell')
    ? unit.sourceWallId.slice(0, -'-shell'.length)
    : undefined
  return !shellRoomId || shellRoomId === activeShellRoomId
}), [activeShellRoomId, geometryCells, layoutMode])
```

Now the room-specific visual rule is explicit and keeps all continuous-street shell units mounted:

```ts
export function mainlineGeometryUnitShouldRender(sceneId, unit, activeRoomId, layoutMode) {
  if (layoutMode) return true
  const shellRoomId = unit.sourceWallId?.endsWith('-shell')
    ? unit.sourceWallId.slice(0, -'-shell'.length)
    : undefined
  if (!shellRoomId) return true
  if (sceneId === 'commercial-street') return true
  return shellRoomId === activeRoomId
}
```

The renderer additionally culls shell cells against their camera-translated viewport coordinates (with 5% overscan), never against `activeShellRoomId`:

```ts
export function mainlineGeometryCellWithinViewport(cell, cameraOffset, overscan = 5) {
  const viewportX = cell.x + cameraOffset.x
  const viewportY = cell.y + cameraOffset.y
  return viewportX >= -overscan && viewportX <= 100 + overscan
    && viewportY >= -overscan && viewportY <= 100 + overscan
}
```

`scene.objects` are still projected with `mainlineEntityBelongsToActiveRoom(entity, activeShellRoomId)`, so room fixtures switch by their owner while the geometry snapshot and passage/collision units remain present. The sign owner now also has an authored region gate: only a player inside `commercial-street-public-lane` can own the near presentation. When the position enters a `*-interior` room, the presentation hook clears linger state to baseline. Existing entrance/rear access, room dimensions, objects, save state, font sizing and pedestrian actor placements are unchanged.

### Scene ownership checks

The top “orphan” pedestrian observed in the prior browser review is the real ambient actor `commercial-street-pedestrian-west-north`, rendered under `scene-mainline-world`. The nearby entrance frame belongs to `storefront:commercial-south-slot-1:baseline` in `scene-portal-characters`; it is not furniture or a duplicate storefront wall. Neither object was deleted. The existing room-scoped object predicate hides indoor fixtures outside their owning room while the fixed world geometry, door/air-wall collision, passages and public-lane pedestrian actors remain independent of that predicate.

The following source detail records the Stage 1 baseline; its two-room scope is superseded by Stage 2 above. At Stage 1, only the two selected front doors were open and linked to the public lane; rear doors had no destination and remained locked:

```ts
const interior = commercialStreetInteriorSamples.find((sample) => sample.storefrontId === storefront.id)
return { id: portalId,
  entity: { id: portalId, label: '门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'double', openLeaves: 'both' } },
  endpoint: { doorPosition: authoredPoint(x, y), threshold: authoredPoint(x, laneY), crossingTarget: authoredPoint(x, laneY) },
  wallOpenings: [], transitionText: '\u6b64\u5e97\u94fa\u5c1a\u672a\u5f00\u653e\u3002', access: interior ? 'open' : 'locked',
  ...(interior ? { routeThrough: true, fromRoomId: 'commercial-street-public-lane', toRoomId: interior.roomId } : {}),
  ...(!interior ? { lockedText: '\u6b64\u5e97\u94fa\u5c1a\u672a\u5f00\u653e\u3002' } : {}) }
// Rear portals use a separate locked passage and an opening in the shell's rear edge.
const commercialStreetRearDoorPortals: MainlineScenePortalBlueprint[] = commercialStreetInteriorSamples.map((sample) => {
  const north = sample.side === 'north'
  const edge = north ? 'top' : 'bottom'
  const centerX = sample.x + sample.width / 2
  const doorId = `${sample.roomId}-rear-door`
  return {
    id: doorId,
    entity: { id: doorId, label: '\u95e8', displayLabel: '\u95e8', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'single', openLeaves: 'both' } },
    endpoint: {
      doorPosition: authoredPoint(centerX, sample.back),
      threshold: authoredPoint(centerX, sample.back + (north ? commercialStreetLaneExpansion : -commercialStreetLaneExpansion)),
      crossingTarget: authoredPoint(centerX, sample.back + (north ? -commercialStreetLaneExpansion : commercialStreetLaneExpansion)),
    },
    wallOpenings: [{ wallId: `${sample.roomId}-shell`, opening: { edge, start: centerX - commercialStreetCellPitch, end: centerX + commercialStreetCellPitch, doorId, labelLayout: 'center' } }],
    transitionText: '\u540e\u95e8\u5c1a\u672a\u63a5\u901a\u3002', access: 'locked', lockedText: '\u540e\u95e8\u5c1a\u672a\u5f00\u653e\u3002',
  }
})
```

The room/wall arrangement and enlarged bounds are:

```ts
walkBounds: box(8, -56, commercialStreetWorldRight - 8, 212),
rooms: [
  { id: 'commercial-street-public-lane', kind: 'corridor', bounds: box(8, 36 - commercialStreetLaneExpansion, commercialStreetWorldRight - 8, 28 + 2 * commercialStreetLaneExpansion) },
  ...commercialStreetInteriorSamples.map((sample) => ({ id: sample.roomId, bounds: box(sample.x, Math.min(sample.facade, sample.back), sample.width, commercialStreetInteriorDepth) })),
],
// Existing north/south facade boundaries are unchanged. Each shell adds only three edges:
...commercialStreetInteriorSamples.map((sample) => ({
  id: `${sample.roomId}-shell`, type: 'room' as const,
  bounds: box(sample.x, Math.min(sample.facade, sample.back), sample.width, commercialStreetInteriorDepth),
  variant: 'commercial-empty-shell', boundaryGeometrySource: 'cell-range' as const,
  boundaryVisualEndpoints: { vertical: sample.side === 'north' ? { end: 'omit' as const } : { start: 'omit' as const } },
  edges: [sample.side === 'north' ? 'top' as const : 'bottom' as const, 'left' as const, 'right' as const],
  openings: [{ edge: sample.side === 'north' ? 'top' as const : 'bottom' as const, start: sample.x + sample.width / 2 - commercialStreetCellPitch, end: sample.x + sample.width / 2 + commercialStreetCellPitch, doorId: `${sample.roomId}-rear-door`, labelLayout: 'center' as const }],
})),
```

### `src/center/runtime/mainlineNavigation.ts`

The previous shop intent classified all clicks behind a commercial facade as an entry intent only while its portal remained locked:

```ts
const storefrontIntent = Boolean((passage.targetSceneId || scene.id === 'commercial-street' && passage.access === 'locked')
  && targetIsInsideStorefrontFrame(scene, passage, requestedTarget))
```

Open sample entry intent is now scoped to the street-to-room direction. This preserves exterior storefront intent while inside-room clicks can select the independently locked rear door:

```ts
const openStorefrontEntryIntent = passage.fromRoomId === 'commercial-street-public-lane'
  && roomForPoint(scene, from)?.id === passage.fromRoomId
const storefrontIntent = Boolean((passage.targetSceneId || scene.id === 'commercial-street' && (passage.access === 'locked' || openStorefrontEntryIntent))
  && targetIsInsideStorefrontFrame(scene, passage, requestedTarget))
```

### `src/center/runtime/mainlineViewport.ts`

The old follow camera clamped y-offset at zero, which cannot follow a negative-y north interior. It now allows positive y translation only as far as needed to keep the expanded world's top edge within its two-unit screen padding:

```ts
const maxY = Math.max(0, cameraEdgePadding - scene.walkBounds.y)
return {
  x: clamp(followAnchor - position.x, minX, 0),
  y: clamp(followAnchor - position.y, minY, maxY),
}
// In mainlineCameraTarget:
const maxY = Math.max(0, 2 - scene.walkBounds.y)
return { x: clamp(desired.x, minX, 0), y: clamp(desired.y, minY, maxY) }
```

No scale or font changes were made. The same follow camera remains attached to the protagonist.

### `src/center/runtime/MainlineSceneRenderer.tsx`

The previous projection rendered every wall cell in every room:

```ts
const geometryCells = useMemo(() => geometryUnits.flatMap((unit) => unit.visual.cells
  .filter(cell => {
    const slot = unit.storefrontId ? activeSwitchableStorefronts.find(candidate => candidate.id === unit.storefrontId) : undefined
```

The following renderer filter was the behavior before the room-transition stability update. It mounted a room's shell only while that room was active:

```ts
const activeShellRoomId = scene.rooms.find((room) => room.id.endsWith('-interior')
  && position.x >= room.bounds.x
  && position.x <= room.bounds.x + room.bounds.width
  && position.y >= room.bounds.y
  && position.y <= room.bounds.y + room.bounds.height)?.id
const geometryCells = useMemo(() => geometryUnits.flatMap((unit) => unit.visual.cells
  .filter(/* storefront projection only; no position or room-visibility check */)),
  [activeSwitchableStorefronts, geometryUnits, switchCells])
const renderedGeometryCells = useMemo(() => geometryCells.filter(({ unit }) => {
  if (layoutMode) return true
  const shellRoomId = unit.sourceWallId?.endsWith('-shell')
    ? unit.sourceWallId.slice(0, -'-shell'.length)
    : undefined
  return !shellRoomId || shellRoomId === activeShellRoomId
}), [activeShellRoomId, geometryCells, layoutMode])
```

This historic filter left the collision/navigation graph intact, but caused room transitions to mount and unmount shell glyphs. The update below removes that active-room dependency for the continuous street.
### `tests/commercialStreetStorefrontInteractions.test.ts`

The earlier storefront assertion required every door to be locked. It now distinguishes the two explicit sample portals. Tests check same-scene route ownership, locked rear doors, room entry/return paths, blocked adjacent back space and camera following. A new actual compiler test runs at 1280x720, 1180x757 and 390x844, checks 11/23 rear anchors against the facade glyph centers, verifies the fixed door and geometry signature across viewports, and checks 22 continuous side anchors including the shared facade/rear corners:

```ts
const roomSamples = [
  ['commercial-north-slot-2', 'commercial-north-n2-interior', 11],
  ['commercial-south-slot-2', 'commercial-south-s2-interior', 23],
] as const
// ...
expect(room.bounds.width).toBeCloseTo(steps.horizontal * (widthCells - 1))
expect(room.bounds.height).toBeCloseTo(steps.vertical * 21)
expect(entry).toMatchObject({ access: 'open', routeThrough: true, fromRoomId: 'commercial-street-public-lane', toRoomId: roomId })
expect(entry.targetSceneId).toBeUndefined()
expect(rear).toMatchObject({ access: 'locked' })
expect(findMainlinePath(entry.crossingTargets[0], interior, street)).not.toBeNull()
expect(findMainlinePath(interior, entry.thresholds[0], street)).not.toBeNull()
expect(isWalkableMainlinePoint({ x: room.bounds.x - steps.horizontal, y: interior.y }, street)).toBe(false)
```

### `e2e/commercial-street-locked-storefront.spec.ts`

The former S2 assertion clicked the entrance and expected a locked-door echo. It now clicks the same visible entrance control and waits for the protagonist to land inside the S2 room bounds while the scene ID remains `commercial-street`. A corresponding N2 case does the same. The milk-tea locked-door test is unchanged.

```ts
await page.locator(`button[data-storefront-cell-id="${storefront.id}-character-1"]`).click()
await page.waitForFunction(({ x, y, width, height }) => {
  const player = document.querySelector<HTMLElement>('[data-actor-id="protagonist"]')
  const px = Number(player?.dataset.runtimeX)
  const py = Number(player?.dataset.runtimeY)
  return Boolean(player && px >= x && px <= x + width && py >= y && py <= y + height)
}, room.bounds, { timeout: 20_000 })
await expect(stage).toHaveAttribute('data-mainline-scene', 'commercial-street')
expect(passage.targetSceneId).toBeUndefined()
```

## Validation and limitations

- Focused Vitest file: `tests/commercialStreetStorefrontInteractions.test.ts` — 15 passed, including the three-viewport compiled anchor and corner checks.
- Related regression set: commercial street storefronts, Cafe behavior/story, scene transitions, navigation barriers and player saves — 6 files, 61 passed.
- `npm run typecheck` — passed.
- `npm run build` — passed. Vite emitted a large-chunk advisory (803 kB main JS); no build errors.
- `git diff --check` — passed after whitespace cleanup.
- Browser E2E could not start its configured Vite server: Windows returned `listen EACCES` on `127.0.0.1:5182`. No alternate port or host was used to bypass that restriction. The N2/S2 E2E cases are in the repository for execution in a permitted browser environment.
- No screenshot was captured or included. The author should inspect the fixed Preview URL and decide whether the in-room shell presentation matches the agreed visual rule.

## Explicitly out of scope

No furniture, NPC, narrative, Cafe migration, additional shop interior, save migration, door unlock, milk-tea action or public release was added. Review Stage 1 before authorizing more shops or interior content.
## Latest review correction (7f9 recovery)

- All 14 authored interior entrances remain open and traversable through their real `routeThrough` passage. Rear doors stay locked. The 7f9 Preview mistakenly changed front access to locked while retaining room linkage only for ownership; the recovery restores `access: interior ? 'open' : 'locked'`, `routeThrough: true`, and the five affected test files' route, path, crossing target, and interior-to-threshold assertions. The tests are not weakened to fit the regression.
- The near-sign presentation remains gated to the public lane. If the player is inside a shell, only that room's owning storefront remains in its fixed `wall-door-wall` glyph state; the other 13 signs remain at baseline. Its existing real portal geometry now also keeps its focus frame mounted while inside, independent of public-lane approach/reveal state. The renderer uses `activeStorefrontInteriorOwner(scene, position)` plus `storefrontDoorFrameShouldRetract(...)` for both geometry-derived and explicit portal frame targets; those groups refer to the compiled doorway cells, not a separately positioned frame. Outside the owning room, the prior approach/reveal retraction behavior is unchanged.
- Added regression coverage verifies the interior owner mapping and that its actual door focus group does not request retraction while unrelated door frames still do. Rear access and crossing paths remain explicitly checked.

### 7f9 recovery validation

- `npm run build` — passed (TypeScript plus Vite build); the existing main bundle size warning remains.
- Focused Vitest: 5 files, 72 tests passed with `--testTimeout=120000`. Eight tests exceeded Vitest's default 5-second timeout under this machine's slow path; the longer timeout completed the same unchanged tests successfully. Initial Vitest cache creation also hit a Windows `EPERM` while renaming under the sandbox OS temp; setting `TEMP`/`TMP` to the existing workspace `.tmp` allowed the run. Existing temporary/profile directories were retained.
- The existing same-path, 1180x757 scale-1 baseline at bce0b1c versus 9d5b726 is recorded above. A fresh post-recovery browser profile was attempted against the local Vite preview, but Playwright navigation to localhost was denied by the execution environment (`ERR_NETWORK_ACCESS_DENIED`, then `ERR_CONNECTION_TIMED_OUT` with escalation). No post-recovery frame-time number is claimed; this rendering-only correction therefore has no verified new performance delta. The timing tool's execution time is not treated as FPS.
- The prior profile script sampled `doorPhases` from the room-fixture selector, so that field did not measure a door and has been removed. Earlier profile outputs cannot be used as evidence of door phase transitions. DOM, wall/glyph counts, frame deltas, long tasks, milestones, and CDP traces remain the valid recorded fields.
