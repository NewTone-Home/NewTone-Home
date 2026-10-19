# Commercial Street Stage 1: Empty Storefront Shells

## Scope and state

This stage implements two empty, walkable shop shells in the existing `commercial-street` scene:

- North N2, `commercial-north-slot-2` (11 character cells wide).
- South S2, `commercial-south-slot-2` (the 23-cell fast-food double bay).

Both entry portals have no `targetSceneId`: passage lifecycle crosses the facade in the existing world coordinates. The Cafe scene, its story and save keys are unchanged. No other shop entrance was opened. Rear doors are authored as locked passages with no destination. The storefront facade, glyph arrangement, door locations, storefront order and lane arrangement are unchanged.

## Grid dimensions and ownership

The implementation uses `boundaryGridStepsFromScreenSpacing()` for both axes. At the standard 1280 x 720 screen metrics, a character pitch is 2.1875% horizontally and 3.8889% vertically. The facade contains 11 and 23 horizontal character centers for N2 and S2. Each shell pins compiled frame coordinates to those same anchors: rear edges have 11/23 anchors and side edges have 22 anchors including both ends. The 22 centers are 21 vertical pitch intervals between the existing facade center and rear-wall center, so the depth is `verticalPitch * 21` (about 81.67 stage units). N2 runs north from its existing facade; S2 runs south. The existing facade is the room front wall and is not recreated by either shell.

Shell corners use the first and last frozen storefront glyph centers. The rear row therefore aligns with the facade at 1280x720, 1180x757, and 390x844 instead of overhanging by half a cell. Room bounds and portal positions stay at their authored world coordinates across screen metrics. The side rows include the rear endpoint and meet the existing facade at the front endpoint; the facade owns that shared front glyph visually. Each shell adds only left, right and rear boundary edges. The rear edge contains the locked rear-door opening. The sample room bounds are registered in `scene.rooms` and linked bidirectionally to the public lane using `routeThrough` passages. The larger y walk bounds let the same scene camera and navmesh reach the rooms. Segmented air walls preserve the established off-storefront barriers and close the new north/south extension everywhere except the two authored bay spans. Thus the expansion does not make unselected store backs walkable.

Shell wall glyphs are filtered at the renderer by their owning room. Visibility uses the discrete active shell room; compiled geometry and focus groups no longer depend on player x/y. Ordinary movement therefore does not rebuild focus groups via this filter. This removes an avoidable per-step invalidation path; no standalone frame-time performance measurement was made. The visual filter leaves compiled units in collision, route and room geometry. Storefront fronts, neighboring shop walls and the Cafe are not hidden by that filter.

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
- `npm run typecheck` — passed.
- `npm run build` — passed; Vite emitted the existing large-chunk advisory.
- The first Playwright all-14 traversal attempt produced no result and was stopped; no screenshots were captured. A later script review found two E2E defects: the storefront-label test referenced `stage` after its local declaration had been removed, and the all-shell test issued one coordinate click to the authored approach instead of stepping the actor there. The contact-resilience test now declares its stage locator locally. The all-shell traversal now moves through on-screen 8-unit waypoints, waits for each real actor position, walks to each interior center and back to the inside door threshold before clicking to exit. This is input-driven walking, not teleportation. The fixed E2E scripts have not yet been rerun in a live browser; do not treat them as passed.
- Existing `phone-v1-round3` and `p1-experience` screenshot-producing flows were not run. The Cafe route assertions in the related compatibility specs were updated to enter the new shell before explicitly addressing the preserved legacy Cafe scene.
- Performance was not profiled; this stage makes no measured frame-time claim.

The committed Stage 2 code, tests, and full source comparison will be linked from the accompanying Notion review note after the preview commit is pushed and its deployment is verified.

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

The shell visibility projection is now separate and keyed by the discrete active room. `geometryCells` remains independent of player position, allowing focus groups and focus-frame targets to reuse stable inputs during ordinary walking:

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

Only the rendered list is filtered. The focus graph uses `geometryCells`, not the rendered list; no per-frame performance measurement was made.
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
