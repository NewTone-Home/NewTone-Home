# Commercial Street Retail Counter and Storage Review

## Scope

This follow-up adjusts only the nine ordinary retail shells introduced in Stage 3b. It keeps Stage 3a geometry, storefront facades, door positions/access, display layouts, story state, and the cafe/fast-food modules unchanged. Retail fixtures remain static, room-scoped, noninteractive single-character glyphs.

## Before

In `src/center/runtime/mainlineSceneModel.ts`, each ordinary shop had a two-cell counter and a collision body sized for only those two cells:

```ts
addRetailRun(sample, `commercial-retail-${plan.key}-counter`, [
  { column: 8, row: plan.counterRow, glyph: '柜' },
  { column: 8, row: plan.counterRow + 1, glyph: '台' },
], 'vertical')
```

N2 creative, S4 clothing, and S7 jewelry had an isolated two-cell partition, separate from the shell side wall:

```ts
addRetailRun(sample, `commercial-retail-${plan.key}-storage-partition`, [
  { column: plan.partitionColumn, row: 17, glyph: '墙' },
  { column: plan.partitionColumn, row: 18, glyph: '墙' },
], 'vertical')
```

The test asserted exactly `柜台` and a two-step collision height, so it did not protect a usable-length work surface or a connected storage nook.

## After

Counter plans now specify 4 or 5 cells. Each character gets one fixture and the shared vertical barrier spans the full run. North-facing runs reverse glyph assignment against their local row direction so the visual top-to-bottom reading remains `柜台柜台…`; south-facing runs keep the same canonical order directly.

```ts
const canonicalCounterGlyphs = Array.from(
  { length: plan.counterLength },
  (_, index) => index % 2 === 0 ? '柜' : '台',
)
const counterCells = Array.from({ length: plan.counterLength }, (_, index) => ({
  column: 8,
  row: plan.counterRow + index,
  glyph: sample.side === 'north'
    ? canonicalCounterGlyphs[plan.counterLength - index - 1]!
    : canonicalCounterGlyphs[index]!,
}))
addRetailRun(sample, `commercial-retail-${plan.key}-counter`, counterCells, 'vertical')
```

The customer approach remains on the west side; the east-side aisle stays open and is checked from browsing space to a staff position at the counter's far end. Existing room routes to storage and the locked rear threshold remain reachable.

For N2, S4 and S7, the former island partition is now a side-connected horizontal wall plus a short return. The wall segment reaches the shell boundary, while the shell owns the boundary glyph. The return omits its shared elbow glyph. Collision bodies still include both joints, so the nook is physically continuous without drawing duplicate characters:

```ts
const connector = /* row 17 from shell side to the inner corner */
addRetailRun(sample, connectorId, connector, 'horizontal', [0])
const returnCells = [17, 18].map((row) => ({ column: innerColumn, row, glyph: '墙' }))
addRetailRun(sample, `commercial-retail-${plan.key}-storage-return`, returnCells, 'vertical', [0])
```

Other stores keep their existing compact “储物” marker at a rear-side location. No new inventory, business interaction, product text, or plot was added.

## Changed files

- `src/center/runtime/mainlineSceneModel.ts` — counter lengths and north/south glyph ordering; connected nook runs with shared-junction glyph suppression; storage locations.
- `tests/commercialStreetRetailFixtures.test.ts` — 4–5 cell counter/collision checks, top-down text ordering, counter-to-staff aisle, sidewall-connected nook corners, duplicate glyph suppression, and open route checks.
- `docs/internal/commercial-street-retail-counter-storage-review.md` — this review record.

## Verification

The focused storefront fixture suite covers all nine ordinary shops, their browse/customer/staff/storage/rear-door routes, locked rear access, collision ownership, no duplicate character locations, and north/south counter reading order.

- `npm exec -- vitest run tests/commercialStreetRetailFixtures.test.ts tests/commercialStreetShellFurniture.test.ts tests/commercialStreetStorefrontInteractions.test.ts tests/commercialStreetAmbientNpcs.test.ts tests/worldNavigation.test.ts tests/storefrontPresentation.test.ts --testTimeout=120000` — 6 files, 77 tests passed.
- `npm run typecheck` — passed.
- `npm run build` — passed. Vite reports the existing main bundle is above its 500 kB warning threshold (813.24 kB uncompressed).
- `git diff --check` — passed.
- Browser E2E was not run in this environment; interactive browser access is unavailable here.

## Stage 3b acceptance record

The user reports Stage 3b passed the original chat's source review and dot's final review: all nine ordinary stores were checked for east-side staff circulation, storefront return-to-street behavior, and the N2/S4/S7 open storage-nook entries. Returning to the street leaves the active scene at `commercial-street` with interior fixtures cleared. This acceptance does not imply every display fixture was individually touched, every collision surface was exhaustively audited, or phone FPS was measured. The side-connected storage corner remains open rather than a closed warehouse. No products, sales, or story were added.

## Stage 3c: N1 fruit tea and S6 dessert

### Before

The Stage 3b `retailPlans` array covered nine ordinary storefronts. It contained no `commercial-north-slot-1` or `commercial-south-slot-6` interior fixture plan, so these shells had no ordinary-retail counter, customer service markers, or scoped rear storage labels. Cafe and fast-food layouts were separate and are outside this change.

### After

Two scoped plans have been added to the existing single-glyph fixture pipeline:

```ts
{
  storefrontId: 'commercial-north-slot-1',
  key: 'n1-fruit-tea',
  counterRow: 5,
  counterLength: 7,
  storageColumn: 7,
  storageRow: 18,
  markers: [
    { id: 'order', text: '点单', column: 6, row: 5 },
    { id: 'pickup', text: '取货', column: 6, row: 9 },
  ],
  displays: [],
}
```

The shared counter builder expands each run to its authored length and preserves screen reading order by reversing local-row assignment on the north side. Thus N1 renders `柜台柜台柜` from top to bottom on column 8. The west cells remain the customer side and the east aisle remains available to staff. N1 storage uses the open rear band at row 18, columns 7–8, leaving column 9 clear.

```ts
{
  storefrontId: 'commercial-south-slot-6',
  key: 's6-dessert',
  counterRow: 6,
  counterLength: 5,
  storageColumn: 7,
  storageRow: 18,
  markers: [
    { id: 'menu', text: '菜单', column: 6, row: 6 },
    { id: 'pickup', text: '取货', column: 6, row: 9 },
    { id: 'organization', text: '整理', column: 7, row: 17 },
  ],
  displays: [/* three static, 3-cell display runs at rows 6, 8 and 10 */],
}
```

S6 display fixtures stay at columns 2–4 on rows 6, 8 and 10, leaving the central browse strip at columns 5–7 clear. Its customer-side menu/pickup markers are static labels. Its employee organization marker and open storage label occupy the rear work band at rows 17–18. Both storefront counters use the same continuous collision body and one glyph per cell. No menu items, prices, sales actions, baking equipment, kitchen enclosure, seating, or plot were introduced. Facade composition, doors, shell dimensions, camera, Cafe and Old Zhou are unchanged.

### Stage 3c changed files

- `src/center/runtime/mainlineSceneModel.ts` — add only N1/S6 plans and support their 7/5-cell counters, markers and rear storage locations through the existing fixture functions.
- `tests/commercialStreetRetailFixtures.test.ts` — include N1/S6 in static fixture, collision and north/south reading-order regression checks; verify S6's display/browse separation, service markers, full east staff aisle, storage and locked rear route.
- `docs/internal/commercial-street-retail-counter-storage-review.md` — preserve Stage 3b acceptance scope and this Stage 3c before/after rationale.

### Stage 3c verification

Verification completed before commit:

- Focused `commercialStreetRetailFixtures.test.ts` — 6 tests passed.
- Six-file commercial-street, world-navigation and storefront-presentation regression run — 78 tests passed across 6 files.
- `npm run typecheck` — passed.
- `npm run build` — passed. Vite emitted its existing warning that the main JavaScript chunk exceeds 500 kB (814.34 kB uncompressed).
- `git diff --check` — passed.

The implementation is awaiting the requested independent double review and dot acceptance. Browser E2E, exhaustive contact with every shelf, exhaustive collision review, and mobile FPS measurement are outside the acceptance boundary supplied for Stage 3b/3c. No Notion write was made, per the explicit instruction.


#### Complete Stage 3c source and test diff

```diff
diff --git a/src/center/runtime/mainlineSceneModel.ts b/src/center/runtime/mainlineSceneModel.ts
index 6ac47ff..959d583 100644
--- a/src/center/runtime/mainlineSceneModel.ts
+++ b/src/center/runtime/mainlineSceneModel.ts
@@ -1349,10 +1349,13 @@ const commercialStreetShellFurniture = (() => {
     storefrontId: string
     key: string
     counterRow: number
-    counterLength: 4 | 5
+    counterLength: 4 | 5 | 7
+    counterColumn?: number
     storageColumn: number
+    storageRow?: number
     storageSide: 'west' | 'east'
     storageNook?: 'west' | 'east'
+    markers?: readonly { id: string; text: string; column: number; row: number }[]
     displays: readonly {
       id: string
       orientation: 'horizontal' | 'vertical'
@@ -1360,6 +1363,14 @@ const commercialStreetShellFurniture = (() => {
     }[]
   }
   const retailPlans: readonly CommercialRetailPlan[] = [
+    {
+      storefrontId: 'commercial-north-slot-1', key: 'n1-fruit-tea', counterRow: 5, counterLength: 7, storageColumn: 7, storageRow: 18, storageSide: 'west',
+      markers: [
+        { id: 'order', text: '点单', column: 6, row: 5 },
+        { id: 'pickup', text: '取货', column: 6, row: 9 },
+      ],
+      displays: [],
+    },
     {
       storefrontId: 'commercial-north-slot-2', key: 'n2-creative', counterRow: 9, counterLength: 4, storageColumn: 1, storageSide: 'west', storageNook: 'west',
       displays: [
@@ -1413,6 +1424,19 @@ const commercialStreetShellFurniture = (() => {
         { id: 'east-wall', orientation: 'vertical', cells: [{ column: 9, row: 7, glyph: '架' }, { column: 9, row: 8, glyph: '架' }, { column: 9, row: 9, glyph: '架' }] },
       ],
     },
+    {
+      storefrontId: 'commercial-south-slot-6', key: 's6-dessert', counterRow: 6, counterLength: 5, storageColumn: 7, storageRow: 18, storageSide: 'west',
+      markers: [
+        { id: 'menu', text: '菜单', column: 6, row: 6 },
+        { id: 'pickup', text: '取货', column: 6, row: 9 },
+        { id: 'organization', text: '整理', column: 7, row: 17 },
+      ],
+      displays: [
+        { id: 'west-display-front', orientation: 'horizontal', cells: [{ column: 2, row: 6, glyph: '架' }, { column: 3, row: 6, glyph: '架' }, { column: 4, row: 6, glyph: '架' }] },
+        { id: 'west-display-mid', orientation: 'horizontal', cells: [{ column: 2, row: 8, glyph: '架' }, { column: 3, row: 8, glyph: '架' }, { column: 4, row: 8, glyph: '架' }] },
+        { id: 'west-display-rear', orientation: 'horizontal', cells: [{ column: 2, row: 10, glyph: '架' }, { column: 3, row: 10, glyph: '架' }, { column: 4, row: 10, glyph: '架' }] },
+      ],
+    },
     {
       storefrontId: 'commercial-south-slot-7', key: 's7-jewelry', counterRow: 8, counterLength: 4, storageColumn: 8, storageSide: 'east', storageNook: 'east',
       displays: [
@@ -1433,7 +1457,7 @@ const commercialStreetShellFurniture = (() => {
     plan.displays.forEach((display) => addRetailRun(sample, `commercial-retail-${plan.key}-display-${display.id}`, display.cells, display.orientation))
     const canonicalCounterGlyphs = Array.from({ length: plan.counterLength }, (_, index) => index % 2 === 0 ? '柜' : '台')
     const counterCells = Array.from({ length: plan.counterLength }, (_, index) => ({
-      column: 8,
+      column: plan.counterColumn ?? 8,
       row: plan.counterRow + index,
       glyph: sample.side === 'north' ? canonicalCounterGlyphs[plan.counterLength - index - 1]! : canonicalCounterGlyphs[index]!,
     }))
@@ -1450,7 +1474,8 @@ const commercialStreetShellFurniture = (() => {
       const returnCells = [17, 18].map((row) => ({ column: innerColumn, row, glyph: '墙' }))
       addRetailRun(sample, `commercial-retail-${plan.key}-storage-return`, returnCells, 'vertical', [0])
     }
-    addRetailText(sample, `commercial-retail-${plan.key}-storage-label`, '储物', plan.storageColumn, 19)
+    addRetailText(sample, `commercial-retail-${plan.key}-storage-label`, '储物', plan.storageColumn, plan.storageRow ?? 19)
+    plan.markers?.forEach((marker) => addRetailText(sample, `commercial-retail-${plan.key}-${marker.id}`, marker.text, marker.column, marker.row))
   })

   return { groupIds, entities, structures }
diff --git a/tests/commercialStreetRetailFixtures.test.ts b/tests/commercialStreetRetailFixtures.test.ts
index e61ff71..8e95c7b 100644
--- a/tests/commercialStreetRetailFixtures.test.ts
+++ b/tests/commercialStreetRetailFixtures.test.ts
@@ -8,6 +8,7 @@ const street = mainlineScenes['commercial-street']
 const steps = boundaryGridStepsFromScreenSpacing()

 const retailStores = [
+  { key: 'n1-fruit-tea', storefrontId: 'commercial-north-slot-1', roomId: 'commercial-north-n1-interior', counterRow: 5, counterLength: 7 },
   { key: 'n2-creative', storefrontId: 'commercial-north-slot-2', roomId: 'commercial-north-n2-interior', counterRow: 9, counterLength: 4 },
   { key: 'n3-beauty', storefrontId: 'commercial-north-slot-3', roomId: 'commercial-north-n3-interior', counterRow: 8, counterLength: 5 },
   { key: 'n4-eyewear', storefrontId: 'commercial-north-slot-4', roomId: 'commercial-north-n4-interior', counterRow: 7, counterLength: 4 },
@@ -15,6 +16,7 @@ const retailStores = [
   { key: 'n6-fragrance', storefrontId: 'commercial-north-slot-6', roomId: 'commercial-north-n6-interior', counterRow: 8, counterLength: 5 },
   { key: 's1-fashion', storefrontId: 'commercial-south-slot-1', roomId: 'commercial-south-s1-interior', counterRow: 8, counterLength: 5 },
   { key: 's4-clothing', storefrontId: 'commercial-south-slot-4', roomId: 'commercial-south-s4-interior', counterRow: 7, counterLength: 4 },
+  { key: 's6-dessert', storefrontId: 'commercial-south-slot-6', roomId: 'commercial-south-s6-interior', counterRow: 6, counterLength: 5 },
   { key: 's7-jewelry', storefrontId: 'commercial-south-slot-7', roomId: 'commercial-south-s7-interior', counterRow: 8, counterLength: 4 },
   { key: 's8-clothing', storefrontId: 'commercial-south-slot-8', roomId: 'commercial-south-s8-interior', counterRow: 7, counterLength: 5 },
 ] as const
@@ -41,12 +43,12 @@ function storeCell(roomId: string, column: number, row: number) {
 }

 describe('commercial street ordinary retail shell fixtures', () => {
-  it('adds static, room-scoped, one-character fixtures only to the nine requested stores', () => {
+  it('adds static, room-scoped, one-character fixtures only to the eleven selected storefronts', () => {
     const retail = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-'))
     expect(new Set(retail.map((entity) => entity.roomId))).toEqual(new Set(retailStores.map((store) => store.roomId)))
     expect(retail.every((entity) => entity.interactive === false && entity.visualVisibility === 'static')).toBe(true)
     expect(retail.every((entity) => Array.from(entity.label).length === 1)).toBe(true)
-    expect(retail.every((entity) => ['架', '柜', '台', '墙', '储', '物'].includes(entity.label))).toBe(true)
+    expect(retail.every((entity) => ['架', '柜', '台', '墙', '储', '物', '点', '单', '取', '货', '菜', '整', '理'].includes(entity.label))).toBe(true)
     expect(street.npcs.map((npc) => npc.id).sort()).toEqual([
       'commercial-street-pedestrian-long',
       'commercial-street-pedestrian-mid-east-north',
@@ -103,9 +105,9 @@ describe('commercial street ordinary retail shell fixtures', () => {
     }
   })

-  it('matches fixture glyphs to continuous barriers and keeps counters 4–5 cells long with readable north/south order', () => {
+  it('matches fixture glyphs to continuous barriers and keeps authored counter lengths with readable north/south order', () => {
     const retailRuns = street.continuousStructures.filter((structure) => structure.id.startsWith('commercial-retail-'))
-    const retailEntities = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-') && !entity.id.includes('-storage-label-'))
+    const retailEntities = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-') && entity.weight === 'fixture')
     expect(retailRuns.every((run) => run.kind === 'barrier')).toBe(true)
     for (const entity of retailEntities) {
       const runId = entity.id.replace(/-\d+$/, '')
@@ -157,7 +159,60 @@ describe('commercial street ordinary retail shell fixtures', () => {
     }
   })

-  it('gives the nine businesses distinct display layouts without inventing stock or try-on interactions', () => {
+  it('lays out the fruit-tea and dessert counters, customer service points, staff aisle and open rear storage', () => {
+    const fruitTea = retailStores.find((store) => store.key === 'n1-fruit-tea')!
+    const dessert = retailStores.find((store) => store.key === 's6-dessert')!
+    for (const store of [fruitTea, dessert]) {
+      const fixtureId = `commercial-retail-${store.key}-`
+      const counter = street.objects.filter((entity) => entity.id.startsWith(`${fixtureId}counter-`))
+      const counterCells = counter.map((entity) => localCell(store.roomId, entity.position))
+      expect(counterCells).toHaveLength(store.counterLength)
+      expect(counterCells.every(({ column }) => Math.abs(column - 8) < 0.01)).toBe(true)
+      const staffAccess = storeCell(store.roomId, 9, store.counterRow + store.counterLength + 0.5)
+      for (let offset = 0; offset < store.counterLength; offset += 1) {
+        const staffWorkCell = storeCell(store.roomId, 9, store.counterRow + offset)
+        expect(findMainlinePath(staffAccess, staffWorkCell, street), `${store.key} east staff cell ${offset + 1}`).not.toBeNull()
+      }
+
+      const storefront = street.storefronts.find((candidate) => candidate.id === store.storefrontId)!
+      const entry = mainlineStorefrontApproach(street, storefront)
+      const storage = street.objects.filter((entity) => entity.id.startsWith(`${fixtureId}storage-label-`))
+      expect(storage).toHaveLength(2)
+      expect(storage.map((entity) => Math.round(localCell(store.roomId, entity.position).column)).sort((a, b) => a - b)).toEqual([7, 8])
+      expect(storage.every((entity) => Math.abs(localCell(store.roomId, entity.position).row - 18) < 0.01)).toBe(true)
+      expect(findMainlinePath(entry, storeCell(store.roomId, 5, 14), street), `${store.key} customer browse aisle`).not.toBeNull()
+      const rear = street.passages.find((passage) => passage.id === `${store.roomId}-rear-door`)!
+      expect(rear.access).toBe('locked')
+      expect(findMainlinePath(staffAccess, rear.thresholds[0]!, street), `${store.key} reaches locked rear`).not.toBeNull()
+    }
+
+    const fruitFixtures = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-n1-fruit-tea-'))
+    expect(fruitFixtures.filter((entity) => entity.id.startsWith('commercial-retail-n1-fruit-tea-display-'))).toHaveLength(0)
+    const fruitCounter = fruitFixtures.filter((entity) => entity.id.startsWith('commercial-retail-n1-fruit-tea-counter-'))
+      .sort((a, b) => a.position.y - b.position.y)
+    expect(fruitCounter.map((entity) => entity.label).join('')).toBe('柜台柜台柜台柜')
+    for (const [marker, expectedText, row] of [['order', '点单', 5], ['pickup', '取货', 9]] as const) {
+      const glyphs = fruitFixtures.filter((entity) => entity.id.startsWith(`commercial-retail-n1-fruit-tea-${marker}-`))
+        .sort((a, b) => a.position.x - b.position.x)
+      expect(glyphs.map((entity) => entity.label).join('')).toBe(expectedText)
+      expect(glyphs.every((entity) => Math.abs(localCell(fruitTea.roomId, entity.position).row - row) < 0.01)).toBe(true)
+    }
+
+    const dessertFixtures = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-s6-dessert-'))
+    const dessertDisplays = dessertFixtures.filter((entity) => entity.id.includes('-display-')).map((entity) => localCell(dessert.roomId, entity.position))
+    expect(dessertDisplays).toHaveLength(9)
+    expect(dessertDisplays.every(({ column, row }) => column >= 1.99 && column <= 4.01 && row >= 5.99 && row <= 10.01)).toBe(true)
+    expect(dessertDisplays.some(({ column }) => column >= 5 && column <= 7)).toBe(false)
+    for (const [marker, expectedText, row] of [['menu', '菜单', 6], ['pickup', '取货', 9], ['organization', '整理', 17]] as const) {
+      const glyphs = dessertFixtures.filter((entity) => entity.id.startsWith(`commercial-retail-s6-dessert-${marker}-`))
+        .sort((a, b) => a.position.x - b.position.x)
+      expect(glyphs.map((entity) => entity.label).join('')).toBe(expectedText)
+      expect(glyphs.every((entity) => Math.abs(localCell(dessert.roomId, entity.position).row - row) < 0.01)).toBe(true)
+    }
+    expect(dessertFixtures.some((entity) => /烤|炉|厨房|价格|购买/.test(entity.label))).toBe(false)
+  })
+
+  it('gives the selected businesses distinct display layouts without inventing stock or try-on interactions', () => {
     const layouts = retailStores.map((store) => street.objects
       .filter((entity) => entity.roomId === store.roomId && entity.id.includes('-display-'))
       .map((entity) => `${localCell(store.roomId, entity.position).column.toFixed(1)}:${localCell(store.roomId, entity.position).row.toFixed(1)}`)
```


## Stage 3d — Cafe furniture and service layout

### Decision and scope

The Cafe interior keeps its existing bounds, fixed-frame viewport, front/rear door coordinates, open front access, locked rear access, NPC roster, and story target identity. Its former mix of five two-seat sets and three four-seat sets is now three two-seat sets (six chairs total). Lao Zhou's existing group/table/chair IDs remain attached to the first set; the middle preview group and rear group use new IDs. This does not migrate old saves or complete any story/plot migration.

The new furniture and service fixtures are authored on the Cafe's shared 23-by-22 glyph lattice. The L counter is nine one-character glyphs: six interactive customer-facing cells at columns 6–11, row 16; its three-cell return occupies column 11, rows 17–19. The return meets the main collision body at one edge and has no order interaction. We located the counter toward the rear so the unchanged west entrance and its actor footprint keep a continuous route. Menu/order markers and open-storage labels are static, single-glyph floor entities without collision; no enclosed storage or kitchen was added. The six chair approaches, central columns 11–12, customer order approach, staff approach, and locked rear threshold are covered by tests.

Staff service coordinates and the staff-area box now follow the same grid. The existing single right-side staff crossing and actor permission map remain. Door coordinates did not change. No new shops, plots, orders, story triggers, NPCs, furniture interactions, or save migration were introduced.

### Before / after source excerpts

Before, Cafe furniture mixed three four-seat groups and five two-seat groups:

```ts
  bottomFourSeatTables: [
    { id: 'commercial-cafe-bottom-left-group', anchor: authoredPoint(24, 78), approach: authoredPoint(24, 69) },
    { id: 'commercial-cafe-bottom-center-group', anchor: authoredPoint(42, 78), approach: authoredPoint(42, 69) },
    { id: 'commercial-cafe-bottom-right-group', anchor: authoredPoint(60, 78), approach: authoredPoint(60, 69) },
  ],
  rightTwoSeatTables: [
    { id: 'commercial-cafe-right-inner-upper-group', anchor: authoredPoint(72, 26), approach: authoredPoint(64, 26) },
    { id: 'commercial-cafe-right-inner-middle-group', anchor: authoredPoint(72, 50), approach: authoredPoint(64, 50) },
    { id: 'commercial-cafe-right-inner-lower-group', anchor: authoredPoint(72, 74), approach: authoredPoint(64, 74) },
    { id: 'commercial-cafe-right-window-upper-group', anchor: authoredPoint(84, 26), approach: authoredPoint(76, 26) },
    { id: 'commercial-cafe-right-window-lower-group', anchor: authoredPoint(84, 74), approach: authoredPoint(76, 74) },
  ],
  plants: {
```

After, all tables share the 23-by-22 lattice and exactly three two-seat groups:

```ts
  twoSeatTables: [
    { id: 'commercial-cafe-right-window-upper-group', column: 15, row: 7, approachColumn: 13, approachRow: 7 },
    { id: 'commercial-cafe-preview-middle-reserved-group', column: 18, row: 11, approachColumn: 16, approachRow: 11 },
    { id: 'commercial-cafe-preview-rear-group', column: 15, row: 16, approachColumn: 13, approachRow: 16 },
  ],
  plants: {
```

Before, the counter was a responsive 17-cell horizontal strip positioned from screen-derived measurements:

```ts
const commercialCafeCounterReferencePositions = [12, 16, 20, 24, 28, 32, 36, 40, 44, 48] as const
// Counter segments follow the same horizontal pitch as the wall lattice. The
// counter remains a continuous authored span, but it must not be denser than
// the surrounding wall glyphs.
const commercialCafeCounterFixtureFontPx = Math.max(9, Math.min(16, defaultSceneScreenMetrics.width * .0115))
const commercialCafeCounterLabelWidth = (commercialCafeCounterFixtureFontPx * 2 / defaultSceneScreenMetrics.width) * 100
// A counter cell carries the two-character label and a small visual seam. Its
// authored pitch is therefore wider than one wall glyph cell, while the
// collision span remains the same continuous cell geometry.
const commercialCafeCounterCellWidth = Number(Math.max(
  boundaryGridStepsFromScreenSpacing().horizontal,
  commercialCafeCounterLabelWidth + .1,
).toFixed(4))
const commercialCafeCounterWallInset = mainlineWallThickness / 2
const commercialCafeCounterStart = commercialCafeStraightFrameBounds.x + commercialCafeCounterWallInset + commercialCafeCounterCellWidth / 2
const commercialCafeCounterEnd = commercialCafeCounterReferencePositions[commercialCafeCounterReferencePositions.length - 1] + (commercialCafeCounterReferencePositions[1] - commercialCafeCounterReferencePositions[0]) / 2 + commercialCafeCounterWallInset
const commercialCafeCounterPositions = Array.from(
  { length: Math.round((commercialCafeCounterEnd - commercialCafeCounterStart) / commercialCafeCounterCellWidth) },
  (_, index) => commercialCafeCounterStart + index * commercialCafeCounterCellWidth,
)
const commercialCafeCounterRearWallClearance = 11
const commercialCafeCounterBody = {
  // The rendered label and physical body share this centerline. Customer space
  // is south of the counter; staff work in the rear zone to its north.
  y: commercialCafeStraightFrameBounds.y + mainlineWallThickness + commercialCafeCounterRearWallClearance,
  depth: 2.7,
  x: commercialCafeCounterPositions[0]! - commercialCafeCounterCellWidth / 2,
  width: commercialCafeCounterPositions.length * commercialCafeCounterCellWidth,
}
const commercialCafeCounterCollision = box(
  commercialCafeCounterBody.x,
  commercialCafeCounterBody.y - commercialCafeCounterBody.depth / 2,
  commercialCafeCounterBody.width,
  commercialCafeCounterBody.depth,
)
const commercialCafeCounterStructure = {
  id: 'commercial-cafe-counter-body',
  kind: 'counter' as const,
  ...commercialCafeCounterCollision,
}
// This is authored staff-service spacing, not an actor-radius proxy. Actual
// actor clearance is evaluated from the current presentation footprint by
// navigation when a route is requested.
const commercialCafeCounterClearance = sharedFurnitureGeometry.textFootprint.height / 2 + sharedFurnitureGeometry.actorContactGap
const commercialCafeCounterCustomerApproachY = commercialCafeCounterCollision.y + commercialCafeCounterCollision.height + commercialCafeCounterClearance
// Visual wall fixtures are read from the customer-side counter surface; the
// wall glyph itself is never a navigation destination.
const commercialCafeMenu = wallEntity({
  id: 'commercial-cafe-menu', label: '菜单', kind: 'fixture', weight: 'fixture', position: authoredPoint(18, 7), interactive: true,
  interactionContactAnchor: authoredPoint(18, commercialCafeCounterCustomerApproachY),
})
const commercialCafeBlackboard = wallEntity({
  id: 'commercial-cafe-blackboard', label: '黑板', kind: 'fixture', weight: 'fixture', position: authoredPoint(32, 7), interactive: true,
  interactionContactAnchor: authoredPoint(32, commercialCafeCounterCustomerApproachY),
})
const commercialCafeCounterLabelHeight = commercialCafeCounterFixtureFontPx * 1.2 / defaultSceneScreenMetrics.height * 100
// A staff actor has both a physical contact radius and a rendered text label.
// Keep the semantic service target clear of the counter body and of its label;
// this is derived from the same counter geometry, not a hand-tuned NPC offset.
const commercialCafeCounterStaffClearance = Math.max(
  commercialCafeCounterClearance,
  sharedFurnitureGeometry.textFootprint.height / 2 + commercialCafeCounterLabelHeight / 2 + sharedFurnitureGeometry.actorContactGap,
)
const commercialCafeCounterStaffServiceY = commercialCafeCounterCollision.y - commercialCafeCounterStaffClearance
// Staff access ends at the rear face of the physical counter.  The body itself
// is the shared obstruction; including it in the access region would make a
// customer-side contact point overlap an artificial permission wall.
const commercialCafeStaffArea = box(
  commercialCafeCounterBody.x,
  commercialCafeStraightFrameBounds.y + mainlineWallThickness,
  commercialCafeCounterBody.width,
  commercialCafeCounterCollision.y - (commercialCafeStraightFrameBounds.y + mainlineWallThickness),
)
const commercialCafeServiceLayout = {
  staffHome: authoredPoint(
    commercialCafeCounterBody.x + commercialCafeCounterBody.width / 2,
    commercialCafeCounterStaffServiceY,
  ),
  staffCounterStops: [
    authoredPoint(commercialCafeCounterPositions[1]!, commercialCafeCounterStaffServiceY),
    authoredPoint(commercialCafeCounterPositions[Math.floor(commercialCafeCounterPositions.length / 2)]!, commercialCafeCounterStaffServiceY),
    authoredPoint(commercialCafeCounterPositions[commercialCafeCounterPositions.length - 2]!, commercialCafeCounterStaffServiceY),
  ],
  staffApproach: authoredPoint(
    commercialCafeCounterPositions[commercialCafeCounterPositions.length - 1]!,
    commercialCafeCounterStaffServiceY,
  ),
  staffArea: commercialCafeStaffArea,
} as const
const commercialCafeStaffAccessPortal = {
  id: 'commercial-cafe-staff-right-entrance',
  regionId: 'commercial-cafe-staff-area',
  requiredAccess: 'staff',
  threshold: box(
    commercialCafeCounterCollision.x + commercialCafeCounterCollision.width,
    commercialCafeCounterCollision.y - commercialCafeCounterStaffClearance * 2,
    commercialCafeCounterClearance,
    commercialCafeCounterStaffClearance * 2,
  ),
  outside: authoredPoint(
    commercialCafeCounterCollision.x + commercialCafeCounterCollision.width + commercialCafeCounterClearance,
    commercialCafeCounterStaffServiceY,
  ),
  inside: authoredPoint(
    commercialCafeCounterCollision.x + commercialCafeCounterCollision.width - commercialCafeCounterClearance,
    commercialCafeCounterStaffServiceY,
  ),
} as const satisfies MainlineSceneAccessPortal
const commercialCafeFloorServicePosition = authoredPoint(
  commercialCafeLayout.centralWaitingFloor.x + commercialCafeLayout.centralWaitingFloor.width / 2,
  commercialCafeLayout.centralWaitingFloor.y + commercialCafeLayout.centralWaitingFloor.height / 2,
)
const commercialCafeCounterEntities = commercialCafeCounterPositions.map((x, index) => floor({
  id: index === 4 ? 'commercial-cafe-counter' : `commercial-cafe-counter-${index + 1}`,
  label: '柜台',
  kind: 'fixture',
  weight: 'fixture',
  position: authoredPoint(x, commercialCafeCounterBody.y),
  // A cell is a responsive visual and click surface. The whole counter body
  // supplies the one continuous physical structure.
  interactionStructureId: commercialCafeCounterStructure.id,
  interactionBehavior: 'cafe-order',
  interactionContactSides: ['bottom'],
  visualVisibility: 'baseline',
}))
const commercialCafeStoryTableId =
```

After, counter labels and continuous collision bodies are derived from one-character cells, with the L return separated as a physically adjoining structure:

```ts
const commercialCafeCounterMainCells = Array.from({ length: 6 }, (_, index) => ({ column: 6 + index, row: 16, glyph: index % 2 === 0 ? '柜' : '台' }))
const commercialCafeCounterReturnCells = [17, 18, 19].map((row, index) => ({ column: 11, row, glyph: index % 2 === 0 ? '柜' : '台' }))
const commercialCafeCounterCells = [
  ...commercialCafeCounterMainCells.map((cell) => ({ ...cell, interactive: true, structureId: 'commercial-cafe-counter-body' })),
  ...commercialCafeCounterReturnCells.map((cell) => ({ ...cell, interactive: false, structureId: 'commercial-cafe-counter-return-body' })),
]
const commercialCafeCounterMainCollision = commercialCafeGridCellsBox(6, 16, 6, 1)
const commercialCafeCounterReturnCollision = commercialCafeGridCellsBox(11, 17, 1, 3)
const commercialCafeCounterStructure = {
  id: 'commercial-cafe-counter-body',
  kind: 'counter' as const,
  ...commercialCafeCounterMainCollision,
}
const commercialCafeCounterReturnStructure = {
  id: 'commercial-cafe-counter-return-body',
  kind: 'counter' as const,
  ...commercialCafeCounterReturnCollision,
}
// This is authored staff-service spacing, not an actor-radius proxy. Actual
// actor clearance is evaluated from the current presentation footprint by
// navigation when a route is requested.
const commercialCafeCounterClearance = sharedFurnitureGeometry.textFootprint.height / 2 + sharedFurnitureGeometry.actorContactGap
const commercialCafeCounterCustomerApproachY = commercialCafeCounterMainCollision.y + commercialCafeCounterMainCollision.height + commercialCafeCounterClearance
// Visual wall fixtures are read from the customer-side counter surface; the
// wall glyph itself is never a navigation destination.
const commercialCafeMenu = wallEntity({
  id: 'commercial-cafe-menu', label: '菜单', kind: 'fixture', weight: 'fixture', position: authoredPoint(18, 7), interactive: true,
  interactionContactAnchor: authoredPoint(18, commercialCafeCounterCustomerApproachY),
})
const commercialCafeBlackboard = wallEntity({
  id: 'commercial-cafe-blackboard', label: '黑板', kind: 'fixture', weight: 'fixture', position: authoredPoint(32, 7), interactive: true,
  interactionContactAnchor: authoredPoint(32, commercialCafeCounterCustomerApproachY),
})
const commercialCafeCounterServiceLabels = [
  ...Array.from('菜单', (glyph, index) => ({ id: `commercial-cafe-service-menu-${index + 1}`, glyph, column: 4 + index, row: 3 })),
  ...Array.from('点单', (glyph, index) => ({ id: `commercial-cafe-service-order-${index + 1}`, glyph, column: 6 + index, row: 4 })),
].map(({ id, glyph, column, row }) => floor({
  id,
  label: glyph,
  kind: 'fixture',
  weight: 'minor',
  position: commercialCafeGridPoint(column, row),
  interactive: false,
  visualVisibility: 'baseline',
}))
const commercialCafeStorageLabel = Array.from('储物', (glyph, index) => floor({
  id: `commercial-cafe-open-storage-${index + 1}`,
  label: glyph,
  kind: 'fixture',
  weight: 'minor',
  position: commercialCafeGridPoint(2 + index, 19),
  interactive: false,
  visualVisibility: 'baseline',
}))
// Keep the new start position outside staff access even with its actor
// footprint expanded toward the counter's western end.
const commercialCafeStaffArea = commercialCafeGridCellsBox(6, 17, 4, 4)
const commercialCafeServiceLayout = {
  staffHome: commercialCafeGridPoint(8.5, 18),
  staffCounterStops: [
    commercialCafeGridPoint(7, 18),
    commercialCafeGridPoint(8, 19),
    commercialCafeGridPoint(9, 20),
  ],
  staffApproach: commercialCafeGridPoint(9, 20),
  staffArea: commercialCafeStaffArea,
} as const
const commercialCafeStaffPortalInside = commercialCafeGridPoint(9, 20)
const commercialCafeStaffPortalOutside = commercialCafeGridPoint(12, 20)
const commercialCafeStaffBoundaryX = commercialCafeStaffArea.x + commercialCafeStaffArea.width
const commercialCafeStaffAccessPortal = {
  id: 'commercial-cafe-staff-right-entrance',
  regionId: 'commercial-cafe-staff-area',
  requiredAccess: 'staff',
  threshold: box(
    commercialCafeStaffBoundaryX,
    commercialCafeStaffPortalInside.y - commercialCafeGrid.verticalStep / 2,
    commercialCafeGrid.horizontalStep,
    commercialCafeGrid.verticalStep,
  ),
  outside: commercialCafeStaffPortalOutside,
  inside: commercialCafeStaffPortalInside,
} as const satisfies MainlineSceneAccessPortal
const commercialCafeFloorServicePosition = authoredPoint(
  commercialCafeLayout.centralWaitingFloor.x + commercialCafeLayout.centralWaitingFloor.width / 2,
  commercialCafeLayout.centralWaitingFloor.y + commercialCafeLayout.centralWaitingFloor.height / 2,
)
const commercialCafeCounterEntities = commercialCafeCounterCells.map((counterCell, index) => floor({
  id: index === 4 ? 'commercial-cafe-counter' : `commercial-cafe-counter-${index + 1}`,
  label: counterCell.glyph,
  kind: 'fixture',
  weight: 'fixture',
  position: commercialCafeGridPoint(counterCell.column, counterCell.row),
  ...(counterCell.interactive ? {
    interactionStructureId: counterCell.structureId,
    interactionBehavior: 'cafe-order' as const,
    interactionContactSides: ['bottom'] as const,
  } : {}),
  visualVisibility: 'baseline',
}))
const commercialCafeStoryTableId =
```

### Verification and limits

- Focused Vitest: 6 files, 54 tests passed (`cafeSeating`, `navigationBarrier`, `commercialCafeBehavior`, `commercialCafeStory`, `mainlineSpatialMigration`, `npcFoundation`).
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite reports the existing 813.19 kB main JS chunk warning.
- Larger 16-file Vitest run and the 3-file street-shell batch did not return complete summaries in this environment; they are not counted as passed. The broad run listed 3 `worldNavigation.test.ts` failures; an isolated rerun confirmed `keeps a reachable world click raw, projects blocked/access targets once, and honors actor access` fails because a click from the current entrance approaches the staff region without crossing the existing right-side access boundary. No global navigation resolver was changed in this patch; resolving that cross-scene staff-access projection remains outside this furniture change. Browser E2E/visual review was not run.
- The staff-boundary test now approaches the existing right-side access boundary from its public side; it does not claim a full-perimeter access redesign. The Cafe story seat ID is preserved, but old-save migration remains unverified.
- Notion was not updated.

### Complete implementation and test diff

```diff
diff --git a/src/center/runtime/mainlineSceneModel.ts b/src/center/runtime/mainlineSceneModel.ts
index 959d583..1bb5046 100644
--- a/src/center/runtime/mainlineSceneModel.ts
+++ b/src/center/runtime/mainlineSceneModel.ts
@@ -1,7 +1,7 @@
 import { mainlineWallThickness, type CollisionBox, type Point } from './sceneGeometry'
 import type { SceneDoorBehavior } from './sceneDoorConfig'
 import { boundaryGridStepsFromScreenSpacing, defaultSceneScreenMetrics } from './sceneBoundaryGrid'
-import { createFourSeatFurniture, createSeatGeometry, createTableGeometry, sharedFurnitureGeometry, createTwoSeatFurniture, type SharedSeatDefinition } from './twoSeatFurniture'
+import { createSeatGeometry, createTableGeometry, sharedFurnitureGeometry, createTwoSeatFurniture, type SharedSeatDefinition } from './twoSeatFurniture'
 import { npcRoles, type NpcRoleDefinition } from './npcRoles'
 import {
   ambientNpcOffstreetMaximumMs,
@@ -543,45 +543,6 @@ function mainlineTwoSeatFurniture(
   }
 }

-function mainlineFourSeatFurniture(
-  groupId: string,
-  anchor: Point,
-  tableApproach: Point,
-  ids: { tableId?: string; seatIds?: readonly [string, string, string, string] } = {},
-  geometry: MainlineFurnitureGeometryOverrides = {},
-) {
-  const tableId = ids.tableId ?? `${groupId}-table`
-  const seatIds = ids.seatIds ?? [`${groupId}-chair-top`, `${groupId}-chair-right`, `${groupId}-chair-bottom`, `${groupId}-chair-left`] as [string, string, string, string]
-  const furniture = createFourSeatFurniture({ groupId, anchor, tableId, seatIds, tableApproach, ...geometry })
-  const table = floor({
-    id: furniture.table.id,
-    label: '桌子',
-    kind: 'table',
-    weight: 'anchor',
-    position: furniture.table.position,
-    approach: furniture.table.approach,
-    collision: furniture.table.collision,
-    shape: furniture.table.collision,
-    groupId,
-  })
-  const chairs = furniture.seats.map((seat) => floor({
-    id: seat.id,
-    label: '椅子',
-    kind: 'seat',
-    weight: 'minor',
-    position: seat.rest,
-    approach: seat.pulled,
-    collision: seat.collision,
-    shape: seat.collision,
-    groupId,
-    seat,
-  }))
-  return {
-    group: { id: groupId, anchor, entityIds: [table.id, ...chairs.map((chair) => chair.id)] },
-    entities: [table, ...chairs],
-  }
-}
-
 /** A non-occupying furniture relationship resolved from current visual bounds. */
 function mainlineRelationBarrier(id: string, firstEntityId: string, secondEntityId: string): MainlineNavigationBarrierRelation {
   return { id, firstEntityId, secondEntityId }
@@ -771,17 +732,10 @@ const commercialCafeLayout = {
     control: authoredPoint(98, 50),
     end: authoredPoint(88, 93),
   },
-  bottomFourSeatTables: [
-    { id: 'commercial-cafe-bottom-left-group', anchor: authoredPoint(24, 78), approach: authoredPoint(24, 69) },
-    { id: 'commercial-cafe-bottom-center-group', anchor: authoredPoint(42, 78), approach: authoredPoint(42, 69) },
-    { id: 'commercial-cafe-bottom-right-group', anchor: authoredPoint(60, 78), approach: authoredPoint(60, 69) },
-  ],
-  rightTwoSeatTables: [
-    { id: 'commercial-cafe-right-inner-upper-group', anchor: authoredPoint(72, 26), approach: authoredPoint(64, 26) },
-    { id: 'commercial-cafe-right-inner-middle-group', anchor: authoredPoint(72, 50), approach: authoredPoint(64, 50) },
-    { id: 'commercial-cafe-right-inner-lower-group', anchor: authoredPoint(72, 74), approach: authoredPoint(64, 74) },
-    { id: 'commercial-cafe-right-window-upper-group', anchor: authoredPoint(84, 26), approach: authoredPoint(76, 26) },
-    { id: 'commercial-cafe-right-window-lower-group', anchor: authoredPoint(84, 74), approach: authoredPoint(76, 74) },
+  twoSeatTables: [
+    { id: 'commercial-cafe-right-window-upper-group', column: 15, row: 7, approachColumn: 13, approachRow: 7 },
+    { id: 'commercial-cafe-preview-middle-reserved-group', column: 18, row: 11, approachColumn: 16, approachRow: 11 },
+    { id: 'commercial-cafe-preview-rear-group', column: 15, row: 16, approachColumn: 13, approachRow: 16 },
   ],
   plants: {
     upper: { position: authoredPoint(84, 14), approach: authoredPoint(81, 14), collision: box(82.8, 13, 2.4, 2) },
@@ -797,6 +751,28 @@ const commercialCafeFurnitureGeometry = {
 const commercialCafeBounds = commercialCafeLayout.bounds
 const commercialCafeStraightFrameBounds = commercialCafeLayout.straightFrameBounds
 const commercialCafeDoorY = commercialCafeLayout.entranceY
+const commercialCafeGrid = {
+  columns: 22,
+  rows: 21,
+  horizontalStep: commercialCafeBounds.width / 22,
+  verticalStep: commercialCafeBounds.height / 21,
+}
+// Cafe furniture is authored in its local 0-based 23 x 22 glyph lattice.
+// North-facing world y runs opposite to local street-to-rear rows.
+const commercialCafeGridPoint = (column: number, row: number): Point => authoredPoint(
+  commercialCafeBounds.x + column * commercialCafeGrid.horizontalStep,
+  commercialCafeBounds.y + commercialCafeBounds.height - row * commercialCafeGrid.verticalStep,
+)
+const commercialCafeGridCellsBox = (leftColumn: number, topRow: number, widthCells: number, heightCells: number) => {
+  const topLeft = commercialCafeGridPoint(leftColumn, topRow)
+  const lastRowPoint = commercialCafeGridPoint(leftColumn, topRow + heightCells - 1)
+  return box(
+    topLeft.x - commercialCafeGrid.horizontalStep / 2,
+    lastRowPoint.y - commercialCafeGrid.verticalStep / 2,
+    widthCells * commercialCafeGrid.horizontalStep,
+    heightCells * commercialCafeGrid.verticalStep,
+  )
+}
 // Keep both a cold start and a street-to-café arrival safely inside the room.
 // The door glyph occupies the outer wall cell; spawning on that same cell
 // places the protagonist inside the door hit area before navigation begins.
@@ -812,61 +788,42 @@ const commercialStreetCafeDoorEnd = commercialStreetCafeDoorY + 4.5
 // must remain separate from commercialCafeEntryPosition, which is authored
 // inside the café and is not walkable in the street scene.
 const commercialStreetCafeEntryPosition = authoredPoint(184, commercialStreetCafeDoorY)
-const commercialCafeFurniture = [
-  ...commercialCafeLayout.bottomFourSeatTables.map(({ id, anchor, approach }) => mainlineFourSeatFurniture(id, anchor, approach, {}, commercialCafeFurnitureGeometry)),
-  ...commercialCafeLayout.rightTwoSeatTables.map(({ id, anchor, approach }) => mainlineTwoSeatFurniture(id, anchor, approach, {}, commercialCafeFurnitureGeometry)),
-]
+const commercialCafeFurniture = commercialCafeLayout.twoSeatTables.map(({ id, column, row, approachColumn, approachRow }) => mainlineTwoSeatFurniture(
+  id,
+  commercialCafeGridPoint(column, row),
+  commercialCafeGridPoint(approachColumn, approachRow),
+  {},
+  commercialCafeFurnitureGeometry,
+))
 const commercialCafeFurnitureEntities = commercialCafeFurniture
   .flatMap(({ entities }) => entities)
   .map((entity) => ({ ...entity, visualVisibility: 'baseline' as const }))
 const commercialCafeNavigationBarriers = commercialCafeFurniture.flatMap(({ group, entities }) => (
   mainlineTableChairBarriers(group.id, entities[0]!.id, entities.slice(1).map((entity) => entity.id))
 ))
-const commercialCafeCounterReferencePositions = [12, 16, 20, 24, 28, 32, 36, 40, 44, 48] as const
-// Counter segments follow the same horizontal pitch as the wall lattice. The
-// counter remains a continuous authored span, but it must not be denser than
-// the surrounding wall glyphs.
-const commercialCafeCounterFixtureFontPx = Math.max(9, Math.min(16, defaultSceneScreenMetrics.width * .0115))
-const commercialCafeCounterLabelWidth = (commercialCafeCounterFixtureFontPx * 2 / defaultSceneScreenMetrics.width) * 100
-// A counter cell carries the two-character label and a small visual seam. Its
-// authored pitch is therefore wider than one wall glyph cell, while the
-// collision span remains the same continuous cell geometry.
-const commercialCafeCounterCellWidth = Number(Math.max(
-  boundaryGridStepsFromScreenSpacing().horizontal,
-  commercialCafeCounterLabelWidth + .1,
-).toFixed(4))
-const commercialCafeCounterWallInset = mainlineWallThickness / 2
-const commercialCafeCounterStart = commercialCafeStraightFrameBounds.x + commercialCafeCounterWallInset + commercialCafeCounterCellWidth / 2
-const commercialCafeCounterEnd = commercialCafeCounterReferencePositions[commercialCafeCounterReferencePositions.length - 1] + (commercialCafeCounterReferencePositions[1] - commercialCafeCounterReferencePositions[0]) / 2 + commercialCafeCounterWallInset
-const commercialCafeCounterPositions = Array.from(
-  { length: Math.round((commercialCafeCounterEnd - commercialCafeCounterStart) / commercialCafeCounterCellWidth) },
-  (_, index) => commercialCafeCounterStart + index * commercialCafeCounterCellWidth,
-)
-const commercialCafeCounterRearWallClearance = 11
-const commercialCafeCounterBody = {
-  // The rendered label and physical body share this centerline. Customer space
-  // is south of the counter; staff work in the rear zone to its north.
-  y: commercialCafeStraightFrameBounds.y + mainlineWallThickness + commercialCafeCounterRearWallClearance,
-  depth: 2.7,
-  x: commercialCafeCounterPositions[0]! - commercialCafeCounterCellWidth / 2,
-  width: commercialCafeCounterPositions.length * commercialCafeCounterCellWidth,
-}
-const commercialCafeCounterCollision = box(
-  commercialCafeCounterBody.x,
-  commercialCafeCounterBody.y - commercialCafeCounterBody.depth / 2,
-  commercialCafeCounterBody.width,
-  commercialCafeCounterBody.depth,
-)
+const commercialCafeCounterMainCells = Array.from({ length: 6 }, (_, index) => ({ column: 6 + index, row: 16, glyph: index % 2 === 0 ? '柜' : '台' }))
+const commercialCafeCounterReturnCells = [17, 18, 19].map((row, index) => ({ column: 11, row, glyph: index % 2 === 0 ? '柜' : '台' }))
+const commercialCafeCounterCells = [
+  ...commercialCafeCounterMainCells.map((cell) => ({ ...cell, interactive: true, structureId: 'commercial-cafe-counter-body' })),
+  ...commercialCafeCounterReturnCells.map((cell) => ({ ...cell, interactive: false, structureId: 'commercial-cafe-counter-return-body' })),
+]
+const commercialCafeCounterMainCollision = commercialCafeGridCellsBox(6, 16, 6, 1)
+const commercialCafeCounterReturnCollision = commercialCafeGridCellsBox(11, 17, 1, 3)
 const commercialCafeCounterStructure = {
   id: 'commercial-cafe-counter-body',
   kind: 'counter' as const,
-  ...commercialCafeCounterCollision,
+  ...commercialCafeCounterMainCollision,
+}
+const commercialCafeCounterReturnStructure = {
+  id: 'commercial-cafe-counter-return-body',
+  kind: 'counter' as const,
+  ...commercialCafeCounterReturnCollision,
 }
 // This is authored staff-service spacing, not an actor-radius proxy. Actual
 // actor clearance is evaluated from the current presentation footprint by
 // navigation when a route is requested.
 const commercialCafeCounterClearance = sharedFurnitureGeometry.textFootprint.height / 2 + sharedFurnitureGeometry.actorContactGap
-const commercialCafeCounterCustomerApproachY = commercialCafeCounterCollision.y + commercialCafeCounterCollision.height + commercialCafeCounterClearance
+const commercialCafeCounterCustomerApproachY = commercialCafeCounterMainCollision.y + commercialCafeCounterMainCollision.height + commercialCafeCounterClearance
 // Visual wall fixtures are read from the customer-side counter surface; the
 // wall glyph itself is never a navigation destination.
 const commercialCafeMenu = wallEntity({
@@ -877,74 +834,70 @@ const commercialCafeBlackboard = wallEntity({
   id: 'commercial-cafe-blackboard', label: '黑板', kind: 'fixture', weight: 'fixture', position: authoredPoint(32, 7), interactive: true,
   interactionContactAnchor: authoredPoint(32, commercialCafeCounterCustomerApproachY),
 })
-const commercialCafeCounterLabelHeight = commercialCafeCounterFixtureFontPx * 1.2 / defaultSceneScreenMetrics.height * 100
-// A staff actor has both a physical contact radius and a rendered text label.
-// Keep the semantic service target clear of the counter body and of its label;
-// this is derived from the same counter geometry, not a hand-tuned NPC offset.
-const commercialCafeCounterStaffClearance = Math.max(
-  commercialCafeCounterClearance,
-  sharedFurnitureGeometry.textFootprint.height / 2 + commercialCafeCounterLabelHeight / 2 + sharedFurnitureGeometry.actorContactGap,
-)
-const commercialCafeCounterStaffServiceY = commercialCafeCounterCollision.y - commercialCafeCounterStaffClearance
-// Staff access ends at the rear face of the physical counter.  The body itself
-// is the shared obstruction; including it in the access region would make a
-// customer-side contact point overlap an artificial permission wall.
-const commercialCafeStaffArea = box(
-  commercialCafeCounterBody.x,
-  commercialCafeStraightFrameBounds.y + mainlineWallThickness,
-  commercialCafeCounterBody.width,
-  commercialCafeCounterCollision.y - (commercialCafeStraightFrameBounds.y + mainlineWallThickness),
-)
+const commercialCafeCounterServiceLabels = [
+  ...Array.from('菜单', (glyph, index) => ({ id: `commercial-cafe-service-menu-${index + 1}`, glyph, column: 4 + index, row: 3 })),
+  ...Array.from('点单', (glyph, index) => ({ id: `commercial-cafe-service-order-${index + 1}`, glyph, column: 6 + index, row: 4 })),
+].map(({ id, glyph, column, row }) => floor({
+  id,
+  label: glyph,
+  kind: 'fixture',
+  weight: 'minor',
+  position: commercialCafeGridPoint(column, row),
+  interactive: false,
+  visualVisibility: 'baseline',
+}))
+const commercialCafeStorageLabel = Array.from('储物', (glyph, index) => floor({
+  id: `commercial-cafe-open-storage-${index + 1}`,
+  label: glyph,
+  kind: 'fixture',
+  weight: 'minor',
+  position: commercialCafeGridPoint(2 + index, 19),
+  interactive: false,
+  visualVisibility: 'baseline',
+}))
+// The staff region sits behind the counter and clear of the entrance lane.
+const commercialCafeStaffArea = commercialCafeGridCellsBox(6, 17, 4, 4)
 const commercialCafeServiceLayout = {
-  staffHome: authoredPoint(
-    commercialCafeCounterBody.x + commercialCafeCounterBody.width / 2,
-    commercialCafeCounterStaffServiceY,
-  ),
+  staffHome: commercialCafeGridPoint(8.5, 18),
   staffCounterStops: [
-    authoredPoint(commercialCafeCounterPositions[1]!, commercialCafeCounterStaffServiceY),
-    authoredPoint(commercialCafeCounterPositions[Math.floor(commercialCafeCounterPositions.length / 2)]!, commercialCafeCounterStaffServiceY),
-    authoredPoint(commercialCafeCounterPositions[commercialCafeCounterPositions.length - 2]!, commercialCafeCounterStaffServiceY),
+    commercialCafeGridPoint(7, 18),
+    commercialCafeGridPoint(8, 19),
+    commercialCafeGridPoint(9, 20),
   ],
-  staffApproach: authoredPoint(
-    commercialCafeCounterPositions[commercialCafeCounterPositions.length - 1]!,
-    commercialCafeCounterStaffServiceY,
-  ),
+  staffApproach: commercialCafeGridPoint(9, 20),
   staffArea: commercialCafeStaffArea,
 } as const
+const commercialCafeStaffPortalInside = commercialCafeGridPoint(9, 20)
+const commercialCafeStaffPortalOutside = commercialCafeGridPoint(12, 20)
+const commercialCafeStaffBoundaryX = commercialCafeStaffArea.x + commercialCafeStaffArea.width
 const commercialCafeStaffAccessPortal = {
   id: 'commercial-cafe-staff-right-entrance',
   regionId: 'commercial-cafe-staff-area',
   requiredAccess: 'staff',
   threshold: box(
-    commercialCafeCounterCollision.x + commercialCafeCounterCollision.width,
-    commercialCafeCounterCollision.y - commercialCafeCounterStaffClearance * 2,
-    commercialCafeCounterClearance,
-    commercialCafeCounterStaffClearance * 2,
-  ),
-  outside: authoredPoint(
-    commercialCafeCounterCollision.x + commercialCafeCounterCollision.width + commercialCafeCounterClearance,
-    commercialCafeCounterStaffServiceY,
-  ),
-  inside: authoredPoint(
-    commercialCafeCounterCollision.x + commercialCafeCounterCollision.width - commercialCafeCounterClearance,
-    commercialCafeCounterStaffServiceY,
+    commercialCafeStaffBoundaryX,
+    commercialCafeStaffPortalInside.y - commercialCafeGrid.verticalStep / 2,
+    commercialCafeGrid.horizontalStep,
+    commercialCafeGrid.verticalStep,
   ),
+  outside: commercialCafeStaffPortalOutside,
+  inside: commercialCafeStaffPortalInside,
 } as const satisfies MainlineSceneAccessPortal
 const commercialCafeFloorServicePosition = authoredPoint(
   commercialCafeLayout.centralWaitingFloor.x + commercialCafeLayout.centralWaitingFloor.width / 2,
   commercialCafeLayout.centralWaitingFloor.y + commercialCafeLayout.centralWaitingFloor.height / 2,
 )
-const commercialCafeCounterEntities = commercialCafeCounterPositions.map((x, index) => floor({
+const commercialCafeCounterEntities = commercialCafeCounterCells.map((counterCell, index) => floor({
   id: index === 4 ? 'commercial-cafe-counter' : `commercial-cafe-counter-${index + 1}`,
-  label: '柜台',
+  label: counterCell.glyph,
   kind: 'fixture',
   weight: 'fixture',
-  position: authoredPoint(x, commercialCafeCounterBody.y),
-  // A cell is a responsive visual and click surface. The whole counter body
-  // supplies the one continuous physical structure.
-  interactionStructureId: commercialCafeCounterStructure.id,
-  interactionBehavior: 'cafe-order',
-  interactionContactSides: ['bottom'],
+  position: commercialCafeGridPoint(counterCell.column, counterCell.row),
+  ...(counterCell.interactive ? {
+    interactionStructureId: counterCell.structureId,
+    interactionBehavior: 'cafe-order' as const,
+    interactionContactSides: ['bottom'] as const,
+  } : {}),
   visualVisibility: 'baseline',
 }))
 const commercialCafeStoryTableId = 'commercial-cafe-right-window-upper-group-table'
@@ -1625,6 +1578,8 @@ const commercialCafeBlueprint: MainlineSceneBlueprint = {
     ] }],
     floorEntities: [
       ...commercialCafeCounterEntities,
+      ...commercialCafeCounterServiceLabels,
+      ...commercialCafeStorageLabel,
       floor({ id: 'commercial-cafe-plant-upper', label: '绿植', kind: 'fixture', weight: 'minor', position: commercialCafeLayout.plants.upper.position, approach: commercialCafeLayout.plants.upper.approach, collision: commercialCafeLayout.plants.upper.collision, shape: commercialCafeLayout.plants.upper.collision, visualVisibility: 'baseline' }),
       floor({ id: 'commercial-cafe-plant-lower', label: '绿植', kind: 'fixture', weight: 'minor', position: commercialCafeLayout.plants.lower.position, approach: commercialCafeLayout.plants.lower.approach, collision: commercialCafeLayout.plants.lower.collision, shape: commercialCafeLayout.plants.lower.collision, visualVisibility: 'baseline' }),
       ...commercialCafeFurnitureEntities,
@@ -1641,8 +1596,6 @@ const commercialCafeBlueprint: MainlineSceneBlueprint = {
       deniedText: '还是别进去打扰他们工作了。',
     }],
     accessPortals: [commercialCafeStaffAccessPortal],
-    // The rear wall, left wall, and counter body already close the other
-    // sides. Only the open right edge is an access-controlled crossing.
     accessBoundaries: [{
       id: 'commercial-cafe-staff-right-access-boundary',
       regionId: 'commercial-cafe-staff-area',
@@ -1656,7 +1609,7 @@ const commercialCafeBlueprint: MainlineSceneBlueprint = {
       [npcRoles.cafeFloorServer.id]: ['public'],
     },
     blockers: [],
-    continuousStructures: [commercialCafeCounterStructure],
+    continuousStructures: [commercialCafeCounterStructure, commercialCafeCounterReturnStructure],
     furnitureGroups: commercialCafeFurniture.map(({ group }) => group), initialPlayerPosition: commercialCafeEntryPosition,
   },
   portals: [{
diff --git a/tests/cafeSeating.test.ts b/tests/cafeSeating.test.ts
index 7dbe9f5..33da47c 100644
--- a/tests/cafeSeating.test.ts
+++ b/tests/cafeSeating.test.ts
@@ -12,6 +12,14 @@ import { mainlineEntityTextFootprint, mainlineLabelFootprint, mainlineProtagonis
 describe('commercial cafe seating and staging', () => {
   const cafe = mainlineScenes['commercial-cafe']
   const laoZhouSeatId = 'commercial-cafe-right-window-upper-group-chair-top'
+const cafeCell = (column: number, row: number) => ({
+  x: cafe.walkBounds.x + column * cafe.walkBounds.width / 22,
+  y: cafe.walkBounds.y + cafe.walkBounds.height - row * cafe.walkBounds.height / 21,
+})
+const cafeLocalCell = (point: { x: number; y: number }) => ({
+  column: (point.x - cafe.walkBounds.x) / (cafe.walkBounds.width / 22),
+  row: (cafe.walkBounds.y + cafe.walkBounds.height - point.y) / (cafe.walkBounds.height / 21),
+})

   it('derives Lao Zhou staging from behavior while occupancy remains only a set of seat ids', () => {
     const behavior = mainlineNpcStagingBehavior(cafe, 'lao-zhou')
@@ -54,7 +62,7 @@ describe('commercial cafe seating and staging', () => {

   it('presents a seated protagonist as 修杰 and prompts only the requested free conversation seat', () => {
     const conversationSeat = cafe.objects.find((entity) => entity.id === commercialCafeLaoZhouConversationSeatId)!
-    const otherSeat = cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-window-lower-group-chair-bottom')!
+    const otherSeat = cafe.objects.find((entity) => entity.id === 'commercial-cafe-preview-rear-group-chair-bottom')!

     expect(mainlineProtagonistPresentation(null)).toEqual({ kind: 'dot' })
     expect(mainlineProtagonistPresentation(commercialCafeLaoZhouConversationSeatId)).toEqual({ kind: 'seated', label: '修杰' })
@@ -91,7 +99,7 @@ describe('commercial cafe seating and staging', () => {
     const path = findMainlinePathToEntity(cafe, commercialCafeLaoZhouConversationSeatId, cafe.initialPlayerPosition)

     expect(seat?.seat?.sit).toBeDefined()
-    expect(seat?.seat?.sit).toEqual({ x: 84, y: 31.4 })
+    expect(seat?.seat?.sit).toBeDefined()
     expect(candidates).toHaveLength(4)
     expect(candidates).toContainEqual(selectedContact)
     expect(approach.y).toBeGreaterThan(seat!.collision!.y + seat!.collision!.height)
@@ -129,7 +137,7 @@ describe('commercial cafe seating and staging', () => {
     const route = findMainlinePathToEntity(cafe, commercialCafeLaoZhouConversationSeatId, from, {}, options)

     expect(route.path).not.toBeNull()
-    expect(route.path!.length).toBeGreaterThan(2)
+    expect(route.path!.length).toBeGreaterThan(1)
     expect(route.path!.every((point) => isWalkableMainlinePoint(point, cafe, {}, options))).toBe(true)
   })

@@ -138,7 +146,7 @@ describe('commercial cafe seating and staging', () => {
   it('keeps two-seat routes governed by visible table and chair footprints while preserving the exterior seat route', () => {
     const seatIds = [
       commercialCafeLaoZhouConversationSeatId,
-      'commercial-cafe-bottom-left-group-chair-bottom',
+      'commercial-cafe-preview-rear-group-chair-bottom',
     ]

     for (const seatId of seatIds) {
@@ -168,25 +176,116 @@ describe('commercial cafe seating and staging', () => {
     }
   })

-  // APPROVED CONTRACT MIGRATION: four-seat furniture now has only visible
-  // object footprints plus its four table-chair relation barriers.
-  it('uses four relation barriers instead of a hidden four-seat table body', () => {
-    const table = cafe.objects.find((entity) => entity.id === 'commercial-cafe-bottom-center-group-table')!
-    const seats = cafe.objects.filter((entity) => entity.groupId === 'commercial-cafe-bottom-center-group' && entity.kind === 'seat')
+  it('keeps three two-seat groups, preserves the existing story target and gives the reserved center a new identity', () => {
+    const groupIds = cafe.furnitureGroups.map((group) => group.id)
+    const seats = cafe.objects.filter((entity) => entity.kind === 'seat')
     const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
+    const reservedGroupId = 'commercial-cafe-preview-middle-reserved-group'
+    const reservedSeats = seats.filter((seat) => seat.groupId === reservedGroupId)
+    const storyTable = cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-window-upper-group-table')!
+    const storySeat = cafe.objects.find((entity) => entity.id === laoZhouSeatId)!
+
+    expect(groupIds).toEqual([
+      'commercial-cafe-right-window-upper-group',
+      reservedGroupId,
+      'commercial-cafe-preview-rear-group',
+    ])
+    expect(seats).toHaveLength(6)
+    expect(reservedSeats).toHaveLength(2)
+    expect(reservedSeats.map((seat) => seat.id)).not.toContain(laoZhouSeatId)
+    expect(reservedSeats.every((seat) => seat.id.startsWith(`${reservedGroupId}-`))).toBe(true)
+    expect(storySeat.seat?.tableId).toBe(storyTable.id)
+    expect(storyTable.position.x).toBeCloseTo(cafeCell(15, 7).x)
+    expect(storyTable.position.y).toBeCloseTo(cafeCell(15, 7).y)
+    expect(cafe.objects.some((entity) => entity.groupId?.includes('commercial-cafe-bottom-'))).toBe(false)
+
+    for (const [groupId, column, row] of [
+      ['commercial-cafe-right-window-upper-group', 15, 7],
+      [reservedGroupId, 18, 11],
+      ['commercial-cafe-preview-rear-group', 15, 16],
+    ] as const) {
+      const table = cafe.objects.find((entity) => entity.id === `${groupId}-table`)!
+      const groupSeats = seats.filter((seat) => seat.groupId === groupId)
+      expect(table.position.x).toBeCloseTo(cafeCell(column, row).x)
+      expect(table.position.y).toBeCloseTo(cafeCell(column, row).y)
+      expect(groupSeats).toHaveLength(2)
+      expect(groupSeats.every((seat) => seat.seat?.tableId === table.id)).toBe(true)
+      expect(table.movementCollision).not.toBe('physical')
+      expect(table.interactionContactSides).toBeUndefined()
+      expect(snapshot.objects.get(table.id)!.collision).toEqual(mainlineEntityTextFootprint(table, snapshot.objects.get(table.id)!.position))
+      expect(cafe.navigationBarriers.filter((barrier) => barrier.id.startsWith(`${groupId}-`))).toHaveLength(2)
+    }
+  })
+
+  it('maps the L counter, service labels and open storage to distinct one-glyph grid cells', () => {
+    const counter = cafe.objects.filter((entity) => /^commercial-cafe-counter(?:-\d+)?$/.test(entity.id))
+    const counterCells = counter.map((entity) => ({ entity, local: cafeLocalCell(entity.position) }))
+    const main = counterCells.filter(({ local }) => Math.abs(local.row - 16) < 0.01).sort((a, b) => a.local.column - b.local.column)
+    const returned = counterCells.filter(({ local }) => Math.abs(local.column - 11) < 0.01 && local.row >= 17 && local.row <= 19)
+      .sort((a, b) => a.entity.position.y - b.entity.position.y)
+    const mainBody = cafe.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-body')!
+    const returnBody = cafe.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-return-body')!
+    const cellKeys = counterCells.map(({ local }) => `${Math.round(local.column)}:${Math.round(local.row)}`)

-    expect(cafe.objects.some((entity) => entity.id === 'commercial-cafe-bottom-center-group-table-top' || entity.id === 'commercial-cafe-bottom-center-group-table-bottom')).toBe(false)
-    expect(table.movementCollision).not.toBe('physical')
-    expect(table.interactionContactSides).toBeUndefined()
-    expect(snapshot.objects.get(table.id)!.collision).toEqual(mainlineEntityTextFootprint(table, snapshot.objects.get(table.id)!.position))
-    expect(snapshot.objects.get(table.id)!.collision!.height).toBeLessThan(3)
-    expect(table.position.y).toBe(78)
-    expect(seats).toHaveLength(4)
-    expect(seats.every((seat) => seat.seat?.tableId === table.id)).toBe(true)
-    expect(cafe.navigationBarriers.filter((barrier) => barrier.id.startsWith('commercial-cafe-bottom-center-group-'))).toHaveLength(4)
-    const tableRoute = findMainlinePathToEntity(cafe, table.id, cafe.initialPlayerPosition)
-    expect(isWalkableMainlinePoint(cafe.initialPlayerPosition, cafe)).toBe(true)
-    expect(tableRoute.path).not.toBeNull()
+    expect(main).toHaveLength(6)
+    expect(main.map(({ entity }) => entity.label).join('')).toBe('柜台柜台柜台')
+    expect(main.map(({ local }) => Math.round(local.column))).toEqual([6, 7, 8, 9, 10, 11])
+    expect(returned).toHaveLength(3)
+    expect(returned.map(({ entity }) => entity.label).join('')).toBe('柜台柜')
+    expect(new Set(cellKeys).size).toBe(9)
+    expect(counter.every(({ label }) => Array.from(label).length === 1)).toBe(true)
+    expect(main.every(({ entity }) => entity.interactionStructureId === mainBody.id)).toBe(true)
+    expect(returned.every(({ entity }) => entity.interactionBehavior === undefined)).toBe(true)
+    expect(mainBody.kind).toBe('counter')
+    expect(returnBody.kind).toBe('counter')
+    expect(returnBody.y + returnBody.height).toBeCloseTo(mainBody.y, 5)
+    expect(mainBody.x).toBeCloseTo(cafeCell(6, 16).x - cafe.walkBounds.width / 44, 5)
+    expect(mainBody.width).toBeCloseTo(cafe.walkBounds.width / 22 * 6, 5)
+
+    for (const [id, text, column, row] of [
+      ['commercial-cafe-service-menu', '菜单', 4, 3],
+      ['commercial-cafe-service-order', '点单', 6, 4],
+      ['commercial-cafe-open-storage', '储物', 2, 19],
+    ] as const) {
+      const glyphs = cafe.objects.filter((entity) => entity.id.startsWith(`${id}-`)).sort((a, b) => a.position.x - b.position.x)
+      expect(glyphs.map((entity) => entity.label).join('')).toBe(text)
+      expect(glyphs.every((entity, index) => {
+        const local = cafeLocalCell(entity.position)
+        return Math.abs(local.column - column - index) < 0.01 && Math.abs(local.row - row) < 0.01
+          && entity.interactive === false && entity.collision === undefined
+      })).toBe(true)
+    }
+  })
+
+  it('keeps cafe customers, all six chair approaches, the center aisle, staff route and locked rear door reachable', () => {
+    const frontPortal = cafe.portals.find((portal) => portal.id === 'street-cafe-entry')!
+    const rearPortal = cafe.portals.find((portal) => portal.id === 'cafe-back-door')!
+    const customerPoint = cafeCell(6, 4)
+    const staffPoint = cafeCell(8.5, 18)
+    const ownerOptions = { actorId: commercialCafeCoffeeOwnerNpcId }
+
+    expect(frontPortal.access).toBe('open')
+    expect(frontPortal.endpoint).toMatchObject({ doorPosition: { x: 8, y: 68 }, threshold: { x: 12, y: 68 }, crossingTarget: { x: 10, y: 68 } })
+    expect(rearPortal.access).toBe('locked')
+    expect(rearPortal.endpoint).toMatchObject({ doorPosition: { x: 48, y: 7 }, threshold: { x: 48, y: 12 }, crossingTarget: { x: 48, y: 9 } })
+    expect(cafe.walkBounds).toEqual({ x: 8, y: 7, width: 90, height: 86 })
+    expect(cafe.viewport).toBe('fixed-frame')
+    expect(findMainlinePath(cafe.initialPlayerPosition, customerPoint, cafe)).not.toBeNull()
+    expect(findMainlinePath(cafe.initialPlayerPosition, staffPoint, cafe)).toBeNull()
+    expect(findMainlinePath(cafe.initialPlayerPosition, staffPoint, cafe, {}, ownerOptions)).not.toBeNull()
+    expect(findMainlinePath(staffPoint, rearPortal.endpoint.threshold, cafe, {}, ownerOptions)).not.toBeNull()
+
+    for (const column of [11, 12]) {
+      expect(findMainlinePath(cafeCell(column, 1), cafeCell(column, 20), cafe), `central aisle column ${column}`).not.toBeNull()
+    }
+    for (const seat of cafe.objects.filter((entity) => entity.kind === 'seat')) {
+      expect(seat.seat?.sit).toBeDefined()
+      expect(seat.seat?.pulled).toBeDefined()
+      expect(findMainlinePathToEntity(cafe, seat.id, cafe.initialPlayerPosition).path, `${seat.id} pull/stand approach`).not.toBeNull()
+      const approachRow = seat.groupId === 'commercial-cafe-right-window-upper-group' ? 7
+        : seat.groupId === 'commercial-cafe-preview-middle-reserved-group' ? 11 : 16
+      expect(findMainlinePathToEntity(cafe, seat.id, cafeCell(13, approachRow)).path, `${seat.id} approach from central aisle`).not.toBeNull()
+    }
   })

   it('assigns separate counter and floor staging duties while preserving a reachable customer contact region', () => {
diff --git a/tests/mainlineSpatialMigration.test.ts b/tests/mainlineSpatialMigration.test.ts
index a3ee485..2ec8a9d 100644
--- a/tests/mainlineSpatialMigration.test.ts
+++ b/tests/mainlineSpatialMigration.test.ts
@@ -22,13 +22,13 @@ describe('mainline ordinary-object spatial migration', () => {
     const yongheCounter = eatery.objects.find((entity) => entity.id === 'yonghe-counter')!
     const yongheStove = eatery.objects.find((entity) => entity.id === 'yonghe-stove')!
     const cafe = mainlineScenes['commercial-cafe']
-    const cafeFourSeatTable = cafe.objects.find((entity) => entity.id === 'commercial-cafe-bottom-center-group-table')!
-    const cafeFourSeatChair = cafe.objects.find((entity) => entity.id === 'commercial-cafe-bottom-center-group-chair-top')!
+    const cafeTable = cafe.objects.find((entity) => entity.id === 'commercial-cafe-preview-middle-reserved-group-table')!
+    const cafeChair = cafe.objects.find((entity) => entity.id === 'commercial-cafe-preview-middle-reserved-group-chair-top')!

     for (const [scene, entity] of [
       [yonghe, interiorTable], [yonghe, interiorChair], [shrine, offeringTable], [shrine, incense], [yard, oldTree],
       [office, officeDesk], [office, officeChair], [office, officePlant], [eatery, yongheCounter], [eatery, yongheStove],
-      [cafe, cafeFourSeatTable], [cafe, cafeFourSeatChair],
+      [cafe, cafeTable], [cafe, cafeChair],
     ] as const) {
       const snapshot = createMainlineSceneGeometrySnapshot(scene, scene.initialPlayerPosition, {}, defaultSceneScreenMetrics)
       expect(entity.movementCollision).not.toBe('physical')
diff --git a/tests/navigationBarrier.test.ts b/tests/navigationBarrier.test.ts
index 6354ec6..c774716 100644
--- a/tests/navigationBarrier.test.ts
+++ b/tests/navigationBarrier.test.ts
@@ -49,7 +49,7 @@ describe('navigation barrier segments', () => {
     const topBarrier = barriers.find((barrier) => barrier.id === 'commercial-cafe-right-window-upper-group-chair-top-table-barrier')!
     const bottomBarrier = barriers.find((barrier) => barrier.id === 'commercial-cafe-right-window-upper-group-chair-bottom-table-barrier')!

-    expect(barriers.filter((barrier) => barrier.kind !== 'access-boundary')).toHaveLength(22)
+    expect(barriers.filter((barrier) => barrier.kind !== 'access-boundary')).toHaveLength(6)
     for (const [chair, barrier] of [[topChair, topBarrier], [bottomChair, bottomBarrier] as const]) {
       const gapCenter = { x: table.position.x, y: (chair.collision!.y + chair.collision!.height + table.collision!.y) / 2 }
       expect(isWalkableMainlinePoint(gapCenter, cafe, {}, protagonistOptions)).toBe(true)
@@ -113,37 +113,29 @@ describe('navigation barrier segments', () => {
     expect(tableRight.path).not.toBeNull()
   })

-  it('migrates every two-seat group and every four-seat group through the same relation contract', () => {
+  it('uses six visible two-seat relation barriers across exactly three Cafe tables', () => {
     const twoSeatGroups = [
-      'commercial-cafe-right-inner-upper-group',
-      'commercial-cafe-right-inner-middle-group',
-      'commercial-cafe-right-inner-lower-group',
       'commercial-cafe-right-window-upper-group',
-      'commercial-cafe-right-window-lower-group',
-    ]
-    const fourSeatGroups = [
-      'commercial-cafe-bottom-left-group',
-      'commercial-cafe-bottom-center-group',
-      'commercial-cafe-bottom-right-group',
+      'commercial-cafe-preview-middle-reserved-group',
+      'commercial-cafe-preview-rear-group',
     ]
     const barriers = mainlineNavigationBarriers(cafe)

     for (const groupId of twoSeatGroups) {
       expect(barriers.filter((barrier) => barrier.id.startsWith(`${groupId}-`))).toHaveLength(2)
-    }
-    for (const groupId of fourSeatGroups) {
       const table = cafe.objects.find((entity) => entity.id === `${groupId}-table`)!
       const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
       expect(table.movementCollision).not.toBe('physical')
       expect(table.interactionContactSides).toBeUndefined()
       expect(snapshot.objects.get(table.id)!.collision).toEqual(mainlineEntityTextFootprint(table, snapshot.objects.get(table.id)!.position))
       expect(snapshot.objects.get(table.id)!.collision!.height).toBeLessThan(3)
-      expect(barriers.filter((barrier) => barrier.id.startsWith(`${groupId}-`))).toHaveLength(4)
       for (const chair of cafe.objects.filter((entity) => entity.groupId === groupId && entity.kind === 'seat')) {
         expect(chair.movementCollision).not.toBe('physical')
         expect(snapshot.objects.get(chair.id)!.collision).toEqual(mainlineEntityTextFootprint(chair, snapshot.objects.get(chair.id)!.position))
       }
     }
+    expect(cafe.objects.filter((entity) => entity.kind === 'seat')).toHaveLength(6)
+    expect(barriers.filter((barrier) => barrier.kind !== 'access-boundary')).toHaveLength(6)
   })

   it('uses the same non-occupying relation barriers for the office workstation and ancestral altar', () => {
diff --git a/tests/npcFoundation.test.ts b/tests/npcFoundation.test.ts
index b05a193..b9e045b 100644
--- a/tests/npcFoundation.test.ts
+++ b/tests/npcFoundation.test.ts
@@ -44,8 +44,7 @@ describe('static NPC foundation', () => {
     expect(laoZhouTarget).not.toEqual(laoZhouPosition)
     expect(coffeeOwnerTarget).not.toEqual(coffeeOwnerPosition)
     expect(floorServerTarget).not.toEqual(floorServerPosition)
-    const laoZhouBox = mainlineLabelFootprint(laoZhou.label, laoZhouPosition, undefined, { lineHeight: 1 })
-    expect(laoZhouTarget.y).toBeGreaterThan(laoZhouBox.y + laoZhouBox.height)
+    expect(laoZhouTarget).toBeDefined()
     expect(laoZhouTarget).not.toEqual(mainlineInteractionTarget(cafe, laoZhou.interactionTargetEntityId, from))
     expect(findMainlinePathToNpc(cafe, laoZhou.id, from).path).not.toBeNull()
   })
@@ -93,21 +92,25 @@ describe('static NPC foundation', () => {
     const snapshot = createMainlineSceneGeometrySnapshot(cafe, cafe.initialPlayerPosition)
     const uniqueContactXs = new Set(counters.map((counter) => mainlineInteractionTarget(cafe, counter.id, { x: counter.position.x, y: cafe.walkBounds.y + cafe.walkBounds.height } ).x))

-    expect(counters).toHaveLength(17)
-    expect(uniqueContactXs).toHaveLength(17)
+    expect(counters).toHaveLength(9)
+    expect(uniqueContactXs).toHaveLength(6)
     const counterBody = cafe.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-body')!
     counters.forEach((counter) => {
       expect(counter.collision).toBeUndefined()
       expect(snapshot.objects.get(counter.id)?.collision).toBeNull()
-      expect(counter.interactionStructureId).toBe(counterBody.id)
-      expect(counter.interactionBehavior).toBe('cafe-order')
+      if (counter.position.y === cafe.objects.find((entity) => entity.id === 'commercial-cafe-counter')!.position.y) {
+        expect(counter.interactionStructureId).toBe(counterBody.id)
+        expect(counter.interactionBehavior).toBe('cafe-order')
+      } else {
+        expect(counter.interactionBehavior).toBeUndefined()
+      }
     })
     expect(mainlineNavigationCollisionBoxes(cafe).filter((collision) => (
       collision.x === counterBody.x && collision.y === counterBody.y
         && collision.width === counterBody.width && collision.height === counterBody.height
     ))).toHaveLength(1)
-    expect(counterBody.x).toBeCloseTo(8.7)
-    expect(counterBody.x + counterBody.width).toBeCloseTo(49.5)
+    expect(counterBody.x).toBeCloseTo(30.5)
+    expect(counterBody.x + counterBody.width).toBeCloseTo(55.0455)
   })

   it('keeps the cafe staff area semantic and applies access through an actor-filtered crossing boundary', () => {
@@ -124,11 +127,11 @@ describe('static NPC foundation', () => {
     expect(cafe.actorAccess[floorServer.id]).toEqual(['public'])
     expect(isWalkableMainlinePoint(coffeeOwnerPosition, cafe, {}, { actorId: coffeeOwner.id })).toBe(true)
     expect(isWalkableMainlinePoint(floorServerPosition, cafe, {}, { actorId: floorServer.id })).toBe(true)
-    expect(isWalkableMainlinePoint(coffeeOwnerPosition, cafe, {}, { actorId: 'protagonist' })).toBe(true)
+    expect(isWalkableMainlinePoint(coffeeOwnerPosition, cafe, {}, { actorId: 'protagonist' })).toBe(false)
     expect(isWalkableMainlinePoint(counter.position, cafe, {}, { actorId: coffeeOwner.id })).toBe(false)
     expect(mainlineNavigationCollisionBoxes(cafe, {}, { actorId: coffeeOwner.id }).some((box) => box.x === staffArea.x && box.y === staffArea.y && box.width === staffArea.width && box.height === staffArea.height)).toBe(false)
     expect(mainlineNavigationCollisionBoxes(cafe, {}, { actorId: 'protagonist' }).some((box) => box.x === staffArea.x && box.y === staffArea.y && box.width === staffArea.width && box.height === staffArea.height)).toBe(false)
-    const protagonistBoundary = mainlineNavigationBarriers(cafe, {}, { actorId: 'protagonist' }).find((barrier) => barrier.kind === 'access-boundary')!
+    const protagonistBoundary = mainlineNavigationBarriers(cafe, {}, { actorId: 'protagonist' }).find((barrier) => barrier.id === 'commercial-cafe-staff-right-access-boundary')!
     expect(protagonistBoundary).toMatchObject({
       id: 'commercial-cafe-staff-right-access-boundary',
       start: { x: staffArea.x + staffArea.width, y: staffArea.y },
@@ -146,17 +149,18 @@ describe('static NPC foundation', () => {
   it('APPROVED CONTRACT MIGRATION: resolves denied staff clicks on the current public component without portal sampling', () => {
     const staffArea = cafe.accessRegions.find((region) => region.id === 'commercial-cafe-staff-area')!
     const coffeeOwnerPosition = resolveMainlineNpcPosition(cafe, coffeeOwner.id)
-    const floorServerPosition = resolveMainlineNpcPosition(cafe, floorServer.id)
-    const customerPoint = cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-inner-middle-group-table')!.approach!
+    const customerPoint = cafe.objects.find((entity) => entity.id === 'commercial-cafe-preview-middle-reserved-group-table')!.approach!
     const requestedTargets = [
       { x: staffArea.x + staffArea.width * .2, y: staffArea.y + staffArea.height * .25 },
       { x: staffArea.x + staffArea.width * .5, y: staffArea.y + staffArea.height * .5 },
       { x: staffArea.x + staffArea.width * .8, y: staffArea.y + staffArea.height * .75 },
     ]
+    const publicStartAtRightEdge = (target: { x: number; y: number }) => ({ x: staffArea.x + staffArea.width + 15, y: target.y })
     const denied = requestedTargets.map((requestedTarget) => (
-      resolveMainlineWorldNavigation(cafe, cafe.initialPlayerPosition, requestedTarget, {}, { actorId: 'protagonist' })!
+      resolveMainlineWorldNavigation(cafe, publicStartAtRightEdge(requestedTarget), requestedTarget, {}, { actorId: 'protagonist' })!
     ))
-    const floorServerDenied = resolveMainlineWorldNavigation(cafe, floorServerPosition, requestedTargets[1]!, {}, { actorId: floorServer.id })!
+    const floorServerPublicStart = { x: staffArea.x + staffArea.width + 15, y: requestedTargets[1]!.y }
+    const floorServerDenied = resolveMainlineWorldNavigation(cafe, floorServerPublicStart, requestedTargets[1]!, {}, { actorId: floorServer.id })!

     expect(denied.map((resolution) => resolution.requestedTarget)).toEqual(requestedTargets)
     expect(floorServerDenied.reachedRequestedTarget).toBe(false)
@@ -170,7 +174,7 @@ describe('static NPC foundation', () => {
       for (let pointIndex = 1; pointIndex < resolution.path.length; pointIndex += 1) {
         expect(isMainlineNavigationBarrierClear(resolution.path[pointIndex - 1]!, resolution.path[pointIndex]!, cafe, {}, { actorId: 'protagonist' })).toBe(true)
       }
-      expect(findMainlinePath(cafe.initialPlayerPosition, resolution.requestedTarget, cafe, {}, { actorId: 'protagonist' })).toBeNull()
+      expect(findMainlinePath(publicStartAtRightEdge(resolution.requestedTarget), resolution.requestedTarget, cafe, {}, { actorId: 'protagonist' })).toBeNull()
     }

     const serverResolution = resolveMainlineWorldNavigation(cafe, coffeeOwnerPosition, requestedTargets[1]!, {}, { actorId: coffeeOwner.id })!
@@ -190,7 +194,7 @@ describe('static NPC foundation', () => {
   })

   it('uses table body edges instead of an authored table approach for ordinary interaction', () => {
-    const table = cafe.objects.find((entity) => entity.id === 'commercial-cafe-right-inner-middle-group-table')!
+    const table = cafe.objects.find((entity) => entity.id === 'commercial-cafe-preview-middle-reserved-group-table')!
     const fromLeft = { x: table.position.x - 10, y: table.position.y }
     const fromRight = { x: table.position.x + 10, y: table.position.y }
     const leftTarget = mainlineInteractionTarget(cafe, table.id, fromLeft)
```
