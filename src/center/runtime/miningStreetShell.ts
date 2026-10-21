import { boundaryGridStepsFromReferenceSpacing } from './sceneBoundaryGrid'
import type { MainlineSceneBlueprint, MainlineStorefrontRole, MainlineStorefrontSlotBlueprint, MainlineScenePortalBlueprint } from './mainlineSceneModel'

/** Distances below count shared wall-grid intervals, never glyph anchors. */
export const miningShopNames = ['修鞋', '永和小馆', '药店', '五金店', '小吃', '面馆', '修理', '早点'] as const
export const miningGrid = boundaryGridStepsFromReferenceSpacing()
type MainlineWallBlueprint = MainlineSceneBlueprint['scene']['walls'][number]
const facadeX = 40
const rowTop = 8
// Candidate street clearance; this is layout data, not a new camera policy.
const laneCells = 6
const laneRight = facadeX + laneCells * miningGrid.horizontal

let boundaryCursor = rowTop
export const miningShopShells = miningShopNames.map((label, index) => {
  const letters = Array.from(label).length
  const sideWallCells = 3
  const widthCells = letters + sideWallCells * 2 + 1
  // Same fixed depth rule as Cafe: 26 wall anchors, 25 pitch intervals.
  const depthCells = 25
  const top = boundaryCursor
  boundaryCursor += widthCells * miningGrid.vertical
  const back = facadeX - depthCells * miningGrid.horizontal
  const firstCenter = top + miningGrid.vertical
  const doorIndex = sideWallCells + Math.floor(letters / 2)
  const doorY = firstCenter + doorIndex * miningGrid.vertical
  const portalId = index === 1 ? 'yonghe-street-entry' : `mining-shop-door-${index + 1}`
  const roomId = `mining-shop-${index + 1}-interior`
  const sideWalls = Array.from({ length: sideWallCells }, () => 'wall' as const)
  const baseline: MainlineStorefrontRole[] = [...sideWalls, ...Array.from({ length: letters }, () => 'sign' as const), ...sideWalls]
  const near = baseline.map((role, cellIndex) => role === 'sign' ? cellIndex === doorIndex ? 'door' as const : 'wall' as const : role)
  const storefront: MainlineStorefrontSlotBlueprint = {
    id: `yonghe-slot-${index + 1}`, wallId: 'mining-street-facade', edge: 'right', label,
    style: 'worn', mode: 'commercial', characterSwitch: true, portalId,
    start: firstCenter - .4995 * miningGrid.vertical,
    end: firstCenter + (baseline.length - 1 + .4995) * miningGrid.vertical,
    composition: { fixedCellCount: baseline.length, baseline, near },
    // Use the existing presentation trigger, anchored to the same real door.
    approach: { x: facadeX + 1.5 * miningGrid.horizontal, y: doorY }, nearRadius: 5,
    presentationFrontage: { depthCells: 2, halfSpanCells: 2 },
  }
  return { label, letters, widthCells, depthCells, top, bottom: boundaryCursor, back, firstCenter, doorY, portalId, roomId, storefront }
})
const rowBottom = boundaryCursor
const worldLeft = Math.min(...miningShopShells.map(shop => shop.back))
const worldTop = rowTop - 2 * miningGrid.vertical
const worldBottom = rowBottom + 3 * miningGrid.vertical
const arrival = { x: facadeX + 3 * miningGrid.horizontal, y: rowBottom + 2 * miningGrid.vertical }

/** The old eatery URL receives the entire shell world too, never a separate interior. */
export function createMiningStreetShellBlueprint(id: 'yonghe-mining-perimeter' | 'yonghe-eatery' = 'yonghe-mining-perimeter'): MainlineSceneBlueprint {
  const shops = miningShopShells
  const eatery = shops[1]!
  const walls: MainlineWallBlueprint[] = [
    {
      id: 'mining-street-facade', type: 'room', bounds: { x: facadeX - miningGrid.horizontal, y: rowTop, width: miningGrid.horizontal, height: rowBottom - rowTop },
      variant: 'worn-shop-row', boundaryGeometrySource: 'cell-range',
      boundaryCoordinateCount: { vertical: shops.reduce((sum, shop) => sum + shop.widthCells, 0) + 1 }, edges: ['right'],
    },
    ...shops.map((shop, index): MainlineWallBlueprint => ({
      id: `${shop.roomId}-shell`, type: 'room',
      bounds: { x: shop.back, y: shop.top, width: facadeX - shop.back, height: shop.bottom - shop.top },
      variant: 'mining-empty-shell', boundaryGeometrySource: 'cell-range',
      boundaryCoordinateCount: { horizontal: shop.depthCells + 1, vertical: shop.widthCells + 1 },
      boundaryVisualEndpoints: { horizontal: { start: 'omit', end: 'omit' } },
      // Each separator is owned once. The facade owns front corners.
      edges: ['left', 'top', ...(index === shops.length - 1 ? ['bottom' as const] : [])],
    })),
    {
      id: 'mining-industrial-edge', type: 'room',
      bounds: { x: laneRight, y: worldTop, width: 3 * miningGrid.horizontal, height: worldBottom - worldTop },
      variant: 'industrial-mine-edge', edges: ['left'],
      features: [
        { id: 'mining-pipes', edge: 'left', start: rowTop + 3 * miningGrid.vertical, end: rowTop + 5 * miningGrid.vertical, glyphs: ['管', '线'] },
        { id: 'mining-fence', edge: 'left', start: rowTop + 16 * miningGrid.vertical, end: rowTop + 18 * miningGrid.vertical, glyphs: ['铁', '栅'] },
        { id: 'mining-metal', edge: 'left', start: rowTop + 30 * miningGrid.vertical, end: rowTop + 32 * miningGrid.vertical, glyphs: ['金', '属'] },
      ],
    },
  ]
  const portals: MainlineScenePortalBlueprint[] = shops.map(shop => ({
    id: shop.portalId,
    entity: { id: shop.portalId, label: shop.label, displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'single', openLeaves: 'both' } },
    endpoint: { doorPosition: { x: facadeX, y: shop.doorY }, threshold: { x: facadeX + 1.5 * miningGrid.horizontal, y: shop.doorY }, crossingTarget: { x: facadeX - 1.5 * miningGrid.horizontal, y: shop.doorY } },
    routeThrough: true, fromRoomId: 'mining-street-public-lane', toRoomId: shop.roomId,
    wallOpenings: [], access: 'open', transitionText: '进入空房间，室内内容尚未制作。',
  }))
  portals.push({
    id: 'yonghe-back-door',
    entity: { id: 'yonghe-back-door', label: '后门', displayLabel: '门', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'single', openLeaves: 'both' } },
    endpoint: { doorPosition: { x: eatery.back, y: eatery.doorY }, threshold: { x: eatery.back + 1.5 * miningGrid.horizontal, y: eatery.doorY }, crossingTarget: { x: eatery.back - 1.5 * miningGrid.horizontal, y: eatery.doorY } },
    wallOpenings: [{ wallId: `${eatery.roomId}-shell`, opening: { edge: 'left', start: eatery.doorY - miningGrid.vertical, end: eatery.doorY + miningGrid.vertical, doorId: 'yonghe-back-door', labelLayout: 'center' } }],
    access: 'locked', lockedText: '后门暂未开放。', transitionText: '后门暂未开放。',
  })
  return {
    id, title: '矿区外围老街', subtitle: '街道与八间空房间共用同一张地图，室内布置和剧情尚未制作。', statusLabel: '矿区外围老街',
    hint: '沿街行走，靠近招牌后经过门洞进入空房间；永和后门暂未开放。',
    presentation: { mode: 'actor-relative', offset: { x: 0, y: 0 } },
    areaLabel: (position) => shops.find(shop => position.x < facadeX && position.x >= shop.back && position.y >= shop.top && position.y <= shop.bottom)?.label ?? '矿区外围老街',
    scene: {
      walkBounds: { x: worldLeft, y: worldTop, width: laneRight - worldLeft + 3 * miningGrid.horizontal, height: worldBottom - worldTop },
      viewport: 'follow-player',
      rooms: [
        { id: 'mining-street-public-lane', kind: 'corridor', bounds: { x: facadeX, y: worldTop, width: laneRight - facadeX, height: worldBottom - worldTop } },
        ...shops.map(shop => ({ id: shop.roomId, bounds: { x: shop.back, y: shop.top, width: facadeX - shop.back, height: shop.bottom - shop.top } })),
      ],
      externalExit: { axis: 'y', direction: 1, threshold: rowBottom + 2.5 * miningGrid.vertical },
      wallDensity: { horizontalBaselineEvery: 1, verticalBaselineEvery: 1 }, walls,
      storefronts: shops.map(shop => shop.storefront), floorEntities: [], furnitureGroups: [], blockers: [],
      airWalls: [
        { id: 'mining-industrial-limit', x: laneRight, y: worldTop, width: 3 * miningGrid.horizontal, height: worldBottom - worldTop },
        { id: 'mining-row-top-limit', x: worldLeft, y: worldTop, width: facadeX - worldLeft, height: rowTop - worldTop },
        { id: 'mining-row-bottom-limit', x: worldLeft, y: rowBottom, width: facadeX - worldLeft, height: worldBottom - rowBottom },
        ...shops.filter(shop => shop.back > worldLeft).map(shop => ({ id: `${shop.roomId}-back-limit`, x: worldLeft, y: shop.top, width: shop.back - worldLeft, height: shop.bottom - shop.top })),
      ],
      initialPlayerPosition: arrival, rideArrivalPosition: arrival,
    },
    portals,
    interactionText: { ...Object.fromEntries(shops.map(shop => [shop.portalId, `${shop.label}的空房间，布置和剧情尚未制作。`])), 'yonghe-back-door': '后门暂未开放。' },
  }
}
