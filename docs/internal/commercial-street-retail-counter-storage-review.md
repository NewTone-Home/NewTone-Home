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

## Stage 3d correction record: Cafe shell furniture

### Baseline and mistaken target

The requested baseline is `37455efce96f26219beae0b723bc7b98cc0fe432`. The actual parent chain was:

```text
37455ef Add fruit tea and dessert retail layouts
└─ 5a91928 Re-layout cafe counter and seating
   └─ a4203a3 Close cafe staff route behind counter
```

`37455ef` is an ancestor of `a4203a3`; `5a91928` is its direct intermediate parent. The mistaken Stage 3d work changed the legacy standalone `mainlinescenes['commercial-cafe']` geometry in `src/center/runtime/mainlineSceneModel.ts`, not the intended Cafe shell in the `commercial-street` scene. Commit `5a91928` touched six files: that model, `tests/cafeSeating.test.ts`, `tests/mainlineSpatialMigration.test.ts`, `tests/navigationBarrier.test.ts`, `tests/npcFoundation.test.ts`, and this review document. Commit `a4203a3` touched four files: that model, `tests/cafeSeating.test.ts`, `tests/npcFoundation.test.ts`, and `tests/worldNavigation.test.ts`.

Those changes were reversed with ordinary revert commits, retaining history rather than resetting it:

- `2b150e2` reverts `a4203a3e0214c815d233a3b29aefaa2d19f765e4`.
- `4592d49` reverts `5a91928f6d7e9196bc6876c4590db0e8cbf26684`.

After both reverts and before the corrected shell edit, `git diff 37455ef... HEAD` was empty for tracked files. `.tmp/` and `.vitest-stage3d/` were left in place. The error came from following the old `commercial-cafe` furniture/seat test surface instead of first selecting `commercialStreetInteriorSamples` by `roomId`.

The misplaced Cafe work had changed the legacy Cafe's eight furniture groups to three two-seat groups. It retained the existing story group ID, table ID, and Lao Zhou seat binding, but moved that table from `(84,26)` to a Cafe-local lattice cell. It also replaced the legacy counter layout with an L counter, added static menu/order/storage labels, and altered the staff region. Thus the story source file itself was not migrated, but the legacy Cafe scene configuration was not untouched. The old `commercialCafeStory.ts` module is byte-for-byte unchanged from the baseline; its table and conversation-seat IDs still point at `commercial-cafe-right-window-upper-group-table` and `commercial-cafe-right-window-upper-group-chair-bottom`.

### Correct target

The intended sample is the `commercialStreetInteriorSamples` record whose `roomId` is `commercial-north-cafe-interior`, consumed by `commercialStreetShellFurniture`. Its `cell(sample, column, row)` maps x using `sample.x + column * commercialStreetCellPitch` and maps north-shell rows toward negative world y from `sample.facade`. The Cafe facade's 23 glyph centers determine the 23-by-22 shell lattice; no Cafe-specific pixel width or old standalone Cafe grid is used.

Before this Stage 3d correction, the shell-furniture builder had no Cafe furniture plan. After it, the builder adds static furniture under that exact `roomId`:

```ts
const northCafe = commercialStreetInteriorSamples.find(
  (sample) => sample.roomId === 'commercial-north-cafe-interior',
)!
```

Three new two-seat groups use table centers `(15,7)`, `(18,11)`, and `(15,16)`. Their six seat IDs all begin `commercial-north-cafe-seat-`; none reuse the old Cafe story group, table, or chair IDs. The new static L counter draws its main cells at `x4..9,y5`; its return glyphs are at `x9,y6..8`. Its collision run includes the shared elbow cell, while `addCounter` draws that shared glyph once. Static `菜单`/`点单` labels use `x4..5,y3` and `x6..7,y4`; the open `储物` marker is at `x2..3,y19` within the requested `x2..4,y18..20` storage zone. A static staff-opening glyph at `(9,9)` leads around the counter return toward the rear corridor. No Cafe NPC, dialogue, order behavior, story trigger, or access-region system is added to this shell.

All new shell entities carry `roomId: 'commercial-north-cafe-interior'` and static visual visibility. Their counter collisions are kept in the shared street scene's continuous-structure list, so geometry remains present independently of the active room renderer filter. The rear passage remains locked and its approach is covered by the new reachability assertion.

The frozen storefront composition function and 14-slot storefront list are unchanged by these Stage 3d edits. The Lao Zhou story module and the legacy `commercial-cafe` blueprint are also unchanged from `37455`; `tests/commercialStreetShellFurniture.test.ts` now pins the old Cafe bounds, eight furniture-group IDs, story table position/binding, and front/rear access states while separately asserting that the new Cafe furniture exists only in the same-street Cafe shell. A `git diff 37455ef... HEAD` of the model shows additions inside `commercialStreetShellFurniture` and no hunk in the standalone Cafe blueprint, storefront composition, or merchant slot list.

### Corrected Stage 3d files

- `src/center/runtime/mainlineSceneModel.ts` — shell-only static Cafe furniture, cell-mapped via the selected north Cafe sample.
- `tests/commercialStreetShellFurniture.test.ts` — exact shell grid, table and seat IDs, unique L-counter glyph cells, joined collision, static labels, staff/rear-door route, and legacy Cafe baseline assertions.
- `docs/internal/commercial-street-retail-counter-storage-review.md` — this correction record and the mistaken-target/revert evidence.

The detailed Stage 3d test/build, commit, push, and Preview results are recorded below after verification completes.