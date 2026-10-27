import { boundaryGridStepsFromReferenceSpacing, sharedNarrowPassageFrameHeight, sharedNarrowPassageFrameIntervals, sharedNarrowPassageWalkHeight, sharedNarrowPassageWalkInset } from './sceneBoundaryGrid'
import type { MainlineSceneBlueprint, MainlineStorefrontRole, MainlineStorefrontSlotBlueprint, MainlineScenePortalBlueprint } from './mainlineSceneModel'

/** Distances count lattice intervals. Shop-owned facade slots exclude the
 * separately counted public divider between adjacent shops. */
export const miningShopNames = ['\u6d17\u8863\u5e97', '\u6c38\u548c\u5c0f\u9986', '\u836f\u5e97', '\u4e94\u91d1\u5e97', '\u4fbf\u5229\u5e97', '\u65c5\u5e97', '\u7535\u5668\u7ef4\u4fee', '\u7406\u53d1\u5e97'] as const
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
// Spatial order is right-to-left. Keep each shop's source index and IDs stable
// while placing Yonghe at the eastern end of the row.
const shopRowRightToLeft = [1, 0, 2, 3, 4, 5, 6, 7] as const

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
  const spatialRank = shopRowRightToLeft.indexOf(index as typeof shopRowRightToLeft[number])
  const occupiedCellsToRight = shopRowRightToLeft.slice(0, spatialRank).reduce((sum: number, shopIndex) => {
    return sum + Array.from(miningShopNames[shopIndex]!).length + 7
  }, 0)
  const right = rowRight - occupiedCellsToRight * horizontal
  const left = right - widthCells * horizontal
  const firstCenter = left + horizontal
  const doorIndex = sideWallCells + Math.floor(letters / 2)
  const isYonghe = index === 1
  const doorX = firstCenter + (isYonghe ? doorIndex - 0.5 : doorIndex) * horizontal
  const portalId = index === 1 ? 'yonghe-street-entry' : 'mining-shop-door-' + (index + 1)
  const roomId = 'mining-shop-' + (index + 1) + '-interior'
  const baseline: MainlineStorefrontRole[] = [
    ...Array.from({ length: sideWallCells }, () => 'wall' as const),
    ...Array.from({ length: letters }, () => 'sign' as const),
    ...Array.from({ length: sideWallCells }, () => 'wall' as const),
  ]
  const near = baseline.map((role, cellIndex) => role === 'sign'
    ? (isYonghe ? cellIndex === sideWallCells + 1 || cellIndex === sideWallCells + 2 : cellIndex === doorIndex) ? 'door' as const : 'wall' as const
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
const eatery = oldShopMetrics[1]!
// Match the narrow Zhongshuyuan passage: five boundary positions form a
// four-cell (112 reference-pixel) frame, inset 1.4% on each side for walking.
const backAlleyFrameHeight = sharedNarrowPassageFrameHeight
const backAlleyWalkInset = sharedNarrowPassageWalkInset
const backAlleyUpperWallY = eatery.back - backAlleyFrameHeight
const backAlleyRoom = {
  id: 'mining-street-back-alley',
  kind: 'corridor' as const,
  bounds: {
    x: rowStartX,
    y: backAlleyUpperWallY + backAlleyWalkInset,
    width: rowRight - rowStartX,
    height: sharedNarrowPassageWalkHeight,
  },
}
const worldTop = Math.min(...oldShopMetrics.map(shop => shop.back), backAlleyUpperWallY)
const worldBottom = laneBottom + 3 * vertical
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
  const shopsRightToLeft = [...shops].sort((a, b) => b.left - a.left)
  const sharedWallTails: MainlineWallBlueprint[] = shopsRightToLeft.slice(0, -1).flatMap((rightShop, index) => {
    const leftShop = shopsRightToLeft[index + 1]!
    if (rightShop.back >= leftShop.back) return []
    const intervalCount = Math.round((leftShop.back - rightShop.back) / vertical)
    return [{
      id: leftShop.roomId + '-shared-right-tail', type: 'room',
      bounds: { x: leftShop.right, y: rightShop.back, width: horizontal, height: leftShop.back - rightShop.back },
      variant: 'mining-empty-shell', boundaryGeometrySource: 'cell-range',
      boundaryCoordinateCount: { vertical: intervalCount + 1 },
      // One-cell tails have no interior anchor, so keep their endpoints
      // visible; longer tails let the adjoining shells own both corners.
      ...(intervalCount > 1 ? { boundaryVisualEndpoints: { vertical: { start: 'omit' as const, end: 'omit' as const } } } : {}),
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
      edges: [...(shop.label === miningShopNames[1] ? [] : ['top' as const]), 'right', ...(index === shops.length - 1 ? ['left' as const] : [])],
    })),
    ...sharedWallTails,
    {
      id: 'mining-street-back-alley-frame', type: 'alley',
      bounds: { x: rowStartX, y: backAlleyUpperWallY, width: rowRight - rowStartX, height: backAlleyFrameHeight },
      variant: 'narrow-corridor', boundaryGeometrySource: 'cell-range',
      boundaryCoordinateCount: { horizontal: Math.round((rowRight - rowStartX) / horizontal) + 1, vertical: sharedNarrowPassageFrameIntervals + 1 },
      boundaryProjection: 'screen-spacing',
      boundaryVisualEndpoints: { vertical: { start: 'omit', end: 'omit' } },
      edges: ['top', 'right', 'bottom'],
    },
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
    : { lockedText: '\u8fd9\u5bb6\u5e97\u8fd8\u6ca1\u5f00\u95e8\u3002', transitionText: '\u8fd9\u5bb6\u5e97\u8fd8\u6ca1\u5f00\u95e8\u3002' }),
  }))
  portals.push(...shops.filter(shop => shop.label !== miningShopNames[1]).map(shop => ({
    id: shop.portalId + '-back-door',
    entity: { id: shop.portalId + '-back-door', label: '\u540e\u95e8', displayLabel: '\u95e8', kind: 'door' as const, weight: 'gateway' as const, surface: 'wall' as const, doorBehavior: { leafCount: 'single' as const, openLeaves: 'both' as const } },
    endpoint: {
      doorPosition: { x: shop.doorX, y: shop.back },
      threshold: { x: shop.doorX, y: shop.back + 1.5 * vertical },
      crossingTarget: { x: shop.doorX, y: shop.back - 1.5 * vertical },
    },
    routeThrough: true,
    fromRoomId: backAlleyRoom.id,
    toRoomId: shop.roomId,
    wallOpenings: [{
      wallId: shop.roomId + '-shell',
      opening: { edge: 'top' as const, start: shop.doorX - horizontal / 2, end: shop.doorX + horizontal / 2, doorId: shop.portalId + '-back-door', labelLayout: 'center' as const },
    }],
    access: 'locked' as const,
    lockedText: '\u8fd9\u5bb6\u5e97\u8fd8\u6ca1\u5f00\u95e8\u3002',
    transitionText: '\u8fd9\u5bb6\u5e97\u8fd8\u6ca1\u5f00\u95e8\u3002',
  })))
  portals.push({
    id: 'yonghe-back-door',
    entity: { id: 'yonghe-back-door', label: '\u540e\u95e8', displayLabel: '\u95e8', kind: 'door', weight: 'gateway', surface: 'wall', doorBehavior: { leafCount: 'single', openLeaves: 'both' } },
    endpoint: {
      doorPosition: { x: eatery.doorX, y: eatery.back },
      threshold: { x: eatery.doorX, y: eatery.back + 1.5 * vertical },
      crossingTarget: { x: eatery.doorX, y: eatery.back - 1.5 * vertical },
    },
    routeThrough: true,
    fromRoomId: backAlleyRoom.id,
    toRoomId: eatery.roomId,
    wallOpenings: [{
      wallId: 'mining-street-back-alley-frame',
      opening: { edge: 'bottom', start: eatery.doorX - horizontal, end: eatery.doorX + horizontal, doorId: 'yonghe-back-door', labelLayout: 'center' },
    }],
    access: 'open',
    transitionText: '',
  })
  const lockedShops = shops.filter((_, index) => index !== 1)
  const oldIndustryStart = oldFacadeX + laneCells * horizontal
  const minOldLeft = Math.min(...shops.map(shop => shop.oldLeft))
  const airWalls = [
    { id: 'mining-industrial-limit', ...rotateRect({ x: oldIndustryStart, y: oldWorldTop, width: 3 * horizontal, height: oldWorldBottom - oldWorldTop }) },
    { id: 'mining-row-top-limit', ...rotateRect({ x: minOldLeft, y: oldWorldTop, width: oldFacadeX - minOldLeft, height: rowTop - oldWorldTop }) },
  ]
  return {
    id, title: '\u77ff\u533a\u5916\u56f4\u8001\u8857', subtitle: '\u5e97\u9762\u3001\u8857\u9053\u548c\u516b\u95f4\u5e97\u5185\u5171\u7528\u4e00\u5f20\u5730\u56fe\uff1b\u4ec5\u6c38\u548c\u5c0f\u9986\u5f00\u653e\u3002', statusLabel: '\u77ff\u533a\u5916\u56f4\u8001\u8857',
    hint: '\u6cbf\u8857\u884c\u8d70\u3002\u53ea\u6709\u6c38\u548c\u5c0f\u9986\u53ef\u4ee5\u8fdb\u5165\uff1b\u5176\u4f59\u5e97\u94fa\u6682\u672a\u5f00\u653e\u3002\u540e\u95e8\u6682\u672a\u5f00\u653e\u3002',
    presentation: { mode: 'actor-relative', offset: { x: 0, y: 0 } },
    areaLabel: position => backAlleyRoom.bounds.x <= position.x && position.x <= backAlleyRoom.bounds.x + backAlleyRoom.bounds.width
      && backAlleyRoom.bounds.y <= position.y && position.y <= backAlleyRoom.bounds.y + backAlleyRoom.bounds.height
      ? '\u540e\u5df7'
      : shops.find(shop =>
        position.x >= shop.left && position.x <= shop.right && position.y >= shop.back && position.y <= facadeY
      )?.label ?? '\u77ff\u533a\u5916\u56f4\u8001\u8857',
    scene: {
      walkBounds: { x: laneLeft, y: worldTop, width: laneRight - laneLeft, height: worldBottom - worldTop },
      viewport: 'follow-player',
      rooms: [
        { id: 'mining-street-public-lane', kind: 'corridor', bounds: { x: laneLeft, y: facadeY, width: laneRight - laneLeft, height: laneCells * vertical } },
        backAlleyRoom,
        ...shops.map(shop => ({ id: shop.roomId, bounds: { x: shop.left, y: shop.back, width: shop.right - shop.left, height: facadeY - shop.back } })),
      ],
      externalExit: { axis: 'x', direction: -1, threshold: rowStartX - 2.5 * horizontal },
      wallDensity: { horizontalBaselineEvery: 1, verticalBaselineEvery: 1 }, walls,
      storefronts: shops.map(shop => shop.storefront), floorEntities: [], furnitureGroups: [], blockers: [],
      accessRegions: lockedShops.map(shop => ({ id: shop.roomId + '-prohibited', x: shop.left, y: shop.back, width: shop.right - shop.left, height: facadeY - shop.back, requiredAccess: 'staff' as const, deniedText: '\u8fd9\u5bb6\u5e97\u8fd8\u6ca1\u5f00\u95e8\u3002' })),
      accessBoundaries: lockedShops.map(shop => ({ id: shop.roomId + '-front-permission', regionId: shop.roomId + '-prohibited', edge: 'bottom' as const })),
      airWalls,
      initialPlayerPosition: arrival, rideArrivalPosition: arrival,
    },
    portals,
    interactionText: {
      ...Object.fromEntries(shops.map((shop, index) => [shop.portalId, index === 1 ? '\u8fdb\u5165\u6c38\u548c\u5c0f\u9986\u3002' : '\u8fd9\u5bb6\u5e97\u8fd8\u6ca1\u5f00\u95e8\u3002'])),
      ...Object.fromEntries(shops.filter(shop => shop.label !== miningShopNames[1]).map(shop => [shop.portalId + '-back-door', '\u8fd9\u5bb6\u5e97\u8fd8\u6ca1\u5f00\u95e8\u3002'])),
    },
  }
}

export const miningShopShells: readonly ShopShell[] = oldShopMetrics
