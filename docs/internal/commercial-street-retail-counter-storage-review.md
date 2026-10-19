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

