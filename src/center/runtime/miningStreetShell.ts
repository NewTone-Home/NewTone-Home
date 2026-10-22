import { boundaryGridStepsFromReferenceSpacing } from './sceneBoundaryGrid'
import type { MainlineSceneBlueprint, MainlineStorefrontRole, MainlineStorefrontSlotBlueprint, MainlineScenePortalBlueprint } from './mainlineSceneModel'

/** Distances count lattice intervals. Shop-owned facade slots exclude the
 * separately counted public divider between adjacent shops. */
export const miningShopNames = ['\u4fee\u978b', '\u6c38\u548c\u5c0f\u9986', '\u836f\u5e97', '\u4e94\u91d1\u5e97', '\u5c0f\u5403', '\u9762\u9986', '\u4fee\u7406', '\u65e9\u70b9'] as const
type MiningShopName = typeof miningShopNames[number]
const depthCoordinateCountOverrides: Partial<Record<MiningShopName, (netFrontageSlots: number) => number>> = {
  '\u6c38\u548c\u5c0f\u9986': netFrontageSlots => {
    const interiorRows = netFrontageSlots * 2
    const endWallAnchors = 2
    return interiorRows + endWallAnchors
  },
}
export const miningGrid = boundaryGridStepsFromReferenceSpacing()
type MainlineWallBlueprint = MainlineSceneBlueprint['scene']['walls'][number]

const rowTop = 8
const oldFacadeX = 40
const laneCells = 6
const sideWallCells = 3
const rowStartX = 8
const facadeY = 40
const horizontal = miningGrid.horizontal
const vertical = miningGrid.vertical

type ShopShell = {
  label: string
  letters: number
  widthCells: number
  netFrontageSlots: number
  depthCells: number
  depthCoordinateCount: number
  top: number
  bottom: number
  back: number
  left: number
  right: number
  firstCenter: number
  doorX: number
  doorY: number
  portalId: string
  roomId: string
  storefront: MainlineStorefrontSlotBlueprint
  oldLeft: number
  oldRight: number
}

const rowLength = miningShopNames.reduce((sum, label) => sum + (Array.from(label).length + 7), 0) * horizontal
const rowRight = rowStartX + rowLength
let oldRowCursor = rowTop
const oldShopMetrics = miningShopNames.map((label, index) => {
  const letters = Array.from(label).length
  const netFrontageSlots = letters + sideWallCells * 2
  const widthCells = netFrontageSlots + 1
  // Keep the seven legacy counts unchanged; Yonghe now uses its explicit net-depth plus end-wall count.
  const depthCoordinateCount = depthCoordinateCountOverrides[label]?.(netFrontageSlots) ?? netFrontageSlots * 2 + 3
  const depthCells = depthCoordinateCount - 1
  const top = oldRowCursor
  const bottom = top + widthCells * vertical
  oldRowCursor = bottom
  const oldDepth = depthCells * horizontal
  const back = facadeY - oldDepth * vertical / horizontal
  const oldLeft = oldFacadeX - oldDepth
  const oldRight = oldFacadeX
  const left = rowRight - (oldRowCursor - rowTop) * horizontal / vertical
  const right = left + widthCells * horizontal
  const firstCenter = left + horizontal
  const doorIndex = sideWallCells + Math.floor(letters / 2)
  const doorX = firstCenter + doorIndex * horizontal
  const portalId = index === 1 ? 'yonghe-street-entry' : 'mining-shop-door-' + (index + 1)
  const roomId = 'mining-shop-' + (index + 1) + '-interior'
  const baseline: MainlineStorefrontRole[] = [
    ...Array.from({ length: sideWallCells }, () => 'wall' as const),
    ...Array.from({ length: letters }, () => 'sign' as const),
    ...Array.from({ length: sideWallCells }, () => 'wall' as const),
  ]
  const near = baseline.map((role, cellIndex) => role === 'sign'
    ? cellIndex === doorIndex ? 'door' as const : 'wall' as const
    : role)
  const storefront: MainlineStorefrontSlotBlueprint = {
    id: 'yonghe-slot-' + (index + 1), wallId: 'mining-street-facade', edge: 'bottom', label,
    style: 'worn', mode: 'commercial', characterSwitch: true, portalId,
    start: firstCenter - .4995 * horizontal,
    end: firstCenter + (baseline.length - .5005) * horizontal,
    composition: { fixedCellCount: baseline.length, baseline, near },
    approach: { x: doorX, y: facadeY + 1.5 * vertical }, nearRadius: 6.1,
    presentationFrontage: { depthCells: 2.5, halfSpanCells: 2 },
  }
  return {
    label, letters, widthCells, netFrontageSlots, depthCells, depthCoordinateCount,
    top, bottom, back, left, right, firstCenter, doorX, doorY: facadeY, portalId, roomId, storefront,
    oldLeft, oldRight,
  }
})
const oldRowBottom = oldRowCursor
const oldWorldTop = rowTop - 2 * vertical
const oldWorldBottom = oldRowBottom + 3 * vertical
const laneLeft = rowStartX - 3 * horizontal
const laneRight = rowRight + 2 * horizontal
const laneBottom = facadeY + laneCells * vertical
const worldTop = Math.min(...oldShopMetrics.map(shop => shop.back))
const worldBottom = laneBottom + 3 * vertical
const eatery = oldShopMetrics[1]!
const arrival = { x: rowStartX - 2 * horizontal, y: facadeY + 3 * vertical }

/** Rotate the map clockwise; keep glyph labels upright along the new facade. */
function rotateRect(rect: { x: number; y: number; width: number; height: number }) {
  return {
    x: rowRight - (rect.y + rect.height - rowTop) * horizontal / vertical,
    y: facadeY + (rect.x - oldFacadeX) * vertical / horizontal,
    width: rect.height * horizontal / vertical,
    height: rect.width * vertical / horizontal,
  }
}

export function createMiningStreetShellBlueprint(id: 'yonghe-mining-perimeter' | 'yonghe-eatery' = 'yonghe-mining-perimeter'): MainlineSceneBlueprint {
  const shops = oldShopMetrics
  const sharedWallTails: MainlineWallBlueprint[] = shops.slice(0, -1).flatMap((rightShop, index) => {
    const leftShop = shops[index + 1]!
    if (rightShop.back >= leftShop.back) return []
    const intervalCount = Math.round((leftShop.back - rightShop.back) / vertical)
    return [{
      id: leftShop.roomId + '-shared-right-tail', type: 'room',
      bounds: { x: leftShop.right, y: rightShop.back, width: horizontal, height: leftShop.back - rightShop.back },
      variant: 'mining-empty-shell', boundaryGeometrySource: 'cell-range',
      boundaryCoordinateCount: { vertical: intervalCount + 1 },
      boundaryVisualEndpoints: { vertical: { start: 'omit', end: 'omit' } },
      edges: ['left'],
    }]
  })
  const walls: MainlineWallBlueprint[] = [
    {
      id: 'mining-street-facade', type: 'room',
      bounds: { x: rowStartX, y: facadeY - vertical, width: rowLength, height: vertical },
      variant: 'worn-shop-row', boundaryGeometrySource: 'cell-range',
      boundaryCoordinateCount: { horizontal: shops.reduce((sum, shop) => sum + shop.widthCells, 0) + 1 },
      edges: ['bottom'],
    },
    ...shops.map((shop, index): MainlineWallBlueprint => ({
      id: shop.roomId + '-shell', type: 'room',
      bounds: { x: shop.left, y: shop.back, width: shop.right - shop.left, height: facadeY - shop.back },
      variant: 'mining-empty-shell', boundaryGeometrySource: 'cell-range',
      boundaryCoordinateCount: { horizontal: shop.widthCells + 1, vertical: shop.depthCoordinateCount },
      boundaryVisualEndpoints: { vertical: { start: 'omit', end: 'omit' } },
      edges: ['top', 'right', ...(index === shops.length - 1 ? ['left' as const] : [])],
    })),
    ...sharedWallTails,
    {
      id: 'mining-industrial-edge', type: 'room',
      bounds: { x: laneLeft, y: laneBottom, width: laneRight - laneLeft, height: 3 * vertical },
      variant: 'industrial-mine-edge', edges: ['top'],
      features: [
        { id: 'mining-pipes', edge: 'top', start: laneLeft + 3 * horizontal, end: laneLeft + 5 * horizontal, glyphs: ['\u7164', '\u7ba1'] },
        { id: 'mining-fence', edge: 'top', start: laneLeft + 16 * horizontal, end: laneLeft + 18 * horizontal, glyphs: ['\u94c1', '\u6805'] },
        { id: 'mining-metal', edge: 'top', start: laneLeft + 30 * horizontal, end: laneLeft + 32 * horizontal, glyphs: ['\u91d1', '\u5c5e'] },
      ],
    },
  ]
  const portals: MainlineScenePortalBlueprint[] = shops.map((shop, index) => ({
    id: shop.portalId,
    entity: { id: shop.portalId, label: shop.label, displayLabel: '\u95e8', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'single', openLeaves: 'both' } },
    endpoint: {
      doorPosition: { x: shop.doorX, y: facadeY },
      threshold: { x: shop.doorX, y: facadeY + 1.5 * vertical },
      crossingTarget: { x: shop.doorX, y: facadeY - 1.5 * vertical },
    },
    routeThrough: true, fromRoomId: 'mining-street-public-lane', toRoomId: shop.roomId,
    wallOpenings: [],
    access: index === 1 ? 'open' : 'locked',
    ...(index === 1
      ? { transitionText: '\u8fdb\u5165\u6c38\u548c\u5c0f\u9986\u3002' }
      : { lockedText: '\u6ca1\u6709\u6743\u9650\u8fdb\u53bb\u3002', transitionText: '\u6ca1\u6709\u6743\u9650\u8fdb\u53bb\u3002' }),
  }))
  portals.push({
    id: 'yonghe-back-door',
    entity: { id: 'yonghe-back-door', label: '\u540e\u95e8', displayLabel: '\u95e8', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'single', openLeaves: 'both' } },
    endpoint: {
      doorPosition: { x: eatery.doorX, y: eatery.back },
      threshold: { x: eatery.doorX, y: eatery.back + 1.5 * vertical },
      crossingTarget: { x: eatery.doorX, y: eatery.back - 1.5 * vertical },
    },
    wallOpenings: [{
      wallId: eatery.roomId + '-shell',
      opening: { edge: 'top', start: eatery.doorX - horizontal, end: eatery.doorX + horizontal, doorId: 'yonghe-back-door', labelLayout: 'center' },
    }],
    access: 'locked', lockedText: '\u540e\u95e8\u6682\u672a\u5f00\u653e\u3002', transitionText: '\u540e\u95e8\u6682\u672a\u5f00\u653e\u3002',
  })
  const lockedShops = shops.filter((_, index) => index !== 1)
  const oldIndustryStart = oldFacadeX + laneCells * horizontal
  const minOldLeft = Math.min(...shops.map(shop => shop.oldLeft))
  const airWalls = [
    { id: 'mining-industrial-limit', ...rotateRect({ x: oldIndustryStart, y: oldWorldTop, width: 3 * horizontal, height: oldWorldBottom - oldWorldTop }) },
    { id: 'mining-row-top-limit', ...rotateRect({ x: minOldLeft, y: oldWorldTop, width: oldFacadeX - minOldLeft, height: rowTop - oldWorldTop }) },
    { id: 'mining-row-bottom-limit', ...rotateRect({ x: minOldLeft, y: oldRowBottom, width: oldFacadeX - minOldLeft, height: oldWorldBottom - oldRowBottom }) },
    ...shops.filter(shop => shop.oldLeft > minOldLeft).map(shop => ({
      id: shop.roomId + '-back-limit',
      ...rotateRect({ x: minOldLeft, y: shop.top, width: shop.oldLeft - minOldLeft, height: shop.bottom - shop.top }),
    })),
  ]
  return {
    id, title: '\u77ff\u533a\u5916\u56f4\u8001\u8857', subtitle: '\u5e97\u9762\u3001\u8857\u9053\u548c\u516b\u95f4\u5e97\u5185\u5171\u7528\u4e00\u5f20\u5730\u56fe\uff1b\u4ec5\u6c38\u548c\u5c0f\u9986\u5f00\u653e\u3002', statusLabel: '\u77ff\u533a\u5916\u56f4\u8001\u8857',
    hint: '\u6cbf\u8857\u884c\u8d70\u3002\u53ea\u6709\u6c38\u548c\u5c0f\u9986\u53ef\u4ee5\u8fdb\u5165\uff1b\u5176\u4f59\u5e97\u94fa\u6682\u672a\u5f00\u653e\u3002\u540e\u95e8\u6682\u672a\u5f00\u653e\u3002',
    presentation: { mode: 'actor-relative', offset: { x: 0, y: 0 } },
    areaLabel: position => shops.find(shop =>
      position.x >= shop.left && position.x <= shop.right && position.y >= shop.back && position.y <= facadeY
    )?.label ?? '\u77ff\u533a\u5916\u56f4\u8001\u8857',
    scene: {
      walkBounds: { x: laneLeft, y: worldTop, width: laneRight - laneLeft, height: worldBottom - worldTop },
      viewport: 'follow-player',
      rooms: [
        { id: 'mining-street-public-lane', kind: 'corridor', bounds: { x: laneLeft, y: facadeY, width: laneRight - laneLeft, height: laneCells * vertical } },
        ...shops.map(shop => ({ id: shop.roomId, bounds: { x: shop.left, y: shop.back, width: shop.right - shop.left, height: facadeY - shop.back } })),
      ],
      externalExit: { axis: 'x', direction: -1, threshold: rowStartX - 2.5 * horizontal },
      wallDensity: { horizontalBaselineEvery: 1, verticalBaselineEvery: 1 }, walls,
      storefronts: shops.map(shop => shop.storefront), floorEntities: [], furnitureGroups: [], blockers: [],
      accessRegions: lockedShops.map(shop => ({ id: shop.roomId + '-prohibited', x: shop.left, y: shop.back, width: shop.right - shop.left, height: facadeY - shop.back, requiredAccess: 'staff' as const, deniedText: '\u6ca1\u6709\u6743\u9650\u8fdb\u53bb\u3002' })),
      accessBoundaries: lockedShops.map(shop => ({ id: shop.roomId + '-front-permission', regionId: shop.roomId + '-prohibited', edge: 'bottom' as const })),
      airWalls,
      initialPlayerPosition: arrival, rideArrivalPosition: arrival,
    },
    portals,
    interactionText: {
      ...Object.fromEntries(shops.map((shop, index) => [shop.portalId, index === 1 ? '\u8fdb\u5165\u6c38\u548c\u5c0f\u9986\u3002' : '\u6ca1\u6709\u6743\u9650\u8fdb\u53bb\u3002'])),
      'yonghe-back-door': '\u540e\u95e8\u6682\u672a\u5f00\u653e\u3002',
    },
  }
}

export const miningShopShells: readonly ShopShell[] = oldShopMetrics
