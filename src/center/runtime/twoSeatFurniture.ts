import type { CollisionBox, Point } from './sceneGeometry'

export type SharedSeatSide = 'top' | 'right' | 'bottom' | 'left'
export type SharedFurnitureOrientation = 'horizontal' | 'vertical'

export type SharedSeatDefinition<TableId extends string = string, SeatId extends string = string> = {
  id: SeatId
  tableId: TableId
  side: SharedSeatSide
  blockedSide: SharedSeatSide
  rest: Point
  pulled: Point
  sit: Point
}

export type SharedSeatSeed<TableId extends string = string, SeatId extends string = string> = Omit<SharedSeatDefinition<TableId, SeatId>, 'blockedSide'>

export type SharedTableGeometry<Id extends string = string> = {
  id: Id
  position: Point
  approach: Point
  collision: CollisionBox
}

export type SharedSeatGeometry<TableId extends string = string, SeatId extends string = string> = SharedSeatDefinition<TableId, SeatId> & {
  collision: CollisionBox
}

export type TwoSeatFurniture = {
  groupId: string
  anchor: Point
  table: SharedTableGeometry
  seats: readonly [SharedSeatGeometry, SharedSeatGeometry]
  bounds: CollisionBox
}

export type FourSeatFurniture = {
  groupId: string
  anchor: Point
  table: SharedTableGeometry
  seats: readonly [SharedSeatGeometry, SharedSeatGeometry, SharedSeatGeometry, SharedSeatGeometry]
  bounds: CollisionBox
}

function unionCollisionBoxes(boxes: readonly CollisionBox[]): CollisionBox {
  const minX = Math.min(...boxes.map((box) => box.x))
  const minY = Math.min(...boxes.map((box) => box.y))
  const maxX = Math.max(...boxes.map((box) => box.x + box.width))
  const maxY = Math.max(...boxes.map((box) => box.y + box.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export const sharedFurnitureGeometry: {
  textFootprint: { width: number; height: number; padding: number }
  tableFootprint: { compactWidth: number; wideWidth: number; height: number; padding: number }
  playerRadius: number
  actorContactGap: number
  seatGap: number
  pulledSeatGap: number
  sitSeatGap: number
} = {
  textFootprint: { width: 3.2, height: 2.3, padding: .08 },
  tableFootprint: { compactWidth: 3.2, wideWidth: 3.4, height: 2.4, padding: .08 },
  playerRadius: .56,
  actorContactGap: .06,
  seatGap: 7,
  pulledSeatGap: 8.5,
  sitSeatGap: 8,
} as const

export function sharedTextFootprint(position: Point, footprint: Pick<CollisionBox, 'width' | 'height' | 'padding'> = sharedFurnitureGeometry.textFootprint): CollisionBox {
  return {
    x: position.x - footprint.width / 2,
    y: position.y - footprint.height / 2,
    width: footprint.width,
    height: footprint.height,
    padding: footprint.padding,
  }
}

export function oppositeSharedSeatSide(side: SharedSeatSide): SharedSeatSide {
  if (side === 'top') return 'bottom'
  if (side === 'right') return 'left'
  if (side === 'bottom') return 'top'
  return 'right'
}

export function sharedSeatApproachPoint(
  definition: Pick<SharedSeatDefinition, 'rest' | 'pulled'>,
  approachSide: SharedSeatSide,
  pulled = false,
  actorRadius = sharedFurnitureGeometry.playerRadius,
): Point {
  const anchor = pulled ? definition.pulled : definition.rest
  const clearance = actorRadius + sharedFurnitureGeometry.textFootprint.padding + sharedFurnitureGeometry.actorContactGap
  if (approachSide === 'top') return { x: anchor.x, y: anchor.y - sharedFurnitureGeometry.textFootprint.height / 2 - clearance }
  if (approachSide === 'bottom') return { x: anchor.x, y: anchor.y + sharedFurnitureGeometry.textFootprint.height / 2 + clearance }
  if (approachSide === 'left') return { x: anchor.x - sharedFurnitureGeometry.textFootprint.width / 2 - clearance, y: anchor.y }
  return { x: anchor.x + sharedFurnitureGeometry.textFootprint.width / 2 + clearance, y: anchor.y }
}

export function sharedSeatApproachPoints(
  definition: Pick<SharedSeatDefinition, 'side' | 'blockedSide' | 'rest' | 'pulled'>,
  pulled = false,
  actorRadius = sharedFurnitureGeometry.playerRadius,
) {
  const sides: SharedSeatSide[] = ['top', 'right', 'bottom', 'left']
  return sides
    .filter((side) => side !== definition.blockedSide)
    .map((side) => ({ side, point: sharedSeatApproachPoint(definition, side, pulled, actorRadius) }))
}

export function createTableGeometry<Id extends string>(
  id: Id,
  position: Point,
  radius: number,
  approach: Point,
  orientation: SharedFurnitureOrientation = 'horizontal',
): SharedTableGeometry<Id> {
  const footprint = sharedFurnitureGeometry.tableFootprint
  const width = radius >= 4 ? footprint.wideWidth : footprint.compactWidth
  const height = footprint.height
  return {
    id,
    position,
    approach,
    collision: sharedTextFootprint(position, {
      width: orientation === 'vertical' ? height : width,
      height: orientation === 'vertical' ? width : height,
      padding: footprint.padding,
    }),
  }
}

export function createSeatGeometry<TableId extends string, SeatId extends string>(
  definition: SharedSeatSeed<TableId, SeatId>,
  orientation: SharedFurnitureOrientation = 'horizontal',
): SharedSeatGeometry<TableId, SeatId> {
  const footprint = sharedFurnitureGeometry.textFootprint
  return {
    ...definition,
    blockedSide: oppositeSharedSeatSide(definition.side),
    collision: sharedTextFootprint(definition.rest, {
      width: orientation === 'vertical' ? footprint.height : footprint.width,
      height: orientation === 'vertical' ? footprint.width : footprint.height,
      padding: footprint.padding,
    }),
  }
}

export function createTwoSeatFurniture({
  groupId,
  anchor,
  tableId = groupId,
  seatIds = [`${groupId}-chair-top`, `${groupId}-chair-bottom`],
  tableApproach = { x: anchor.x - 7, y: anchor.y },
  tableRadius = 4,
  seatGap = sharedFurnitureGeometry.seatGap,
  pulledSeatGap,
  sitSeatGap = seatGap + (sharedFurnitureGeometry.sitSeatGap - sharedFurnitureGeometry.seatGap),
}: {
  groupId: string
  anchor: Point
  tableId?: string
  seatIds?: readonly [string, string]
  tableApproach?: Point
  tableRadius?: number
  seatGap?: number
  pulledSeatGap?: number
  sitSeatGap?: number
}): TwoSeatFurniture {
  const minimumPulledGap = seatGap
    + sharedFurnitureGeometry.textFootprint.height / 2
    + sharedFurnitureGeometry.playerRadius
    + sharedFurnitureGeometry.actorContactGap
  const resolvedPulledSeatGap = Math.max(
    pulledSeatGap ?? seatGap + (sharedFurnitureGeometry.pulledSeatGap - sharedFurnitureGeometry.seatGap),
    minimumPulledGap,
  )
  const topRest = { x: anchor.x, y: anchor.y - seatGap }
  const bottomRest = { x: anchor.x, y: anchor.y + seatGap }
  const top = createSeatGeometry({
    id: seatIds[0],
    tableId,
    side: 'top',
    rest: topRest,
    pulled: { x: anchor.x, y: anchor.y - resolvedPulledSeatGap },
    sit: { x: anchor.x, y: anchor.y - sitSeatGap },
  })
  const bottom = createSeatGeometry({
    id: seatIds[1],
    tableId,
    side: 'bottom',
    rest: bottomRest,
    pulled: { x: anchor.x, y: anchor.y + resolvedPulledSeatGap },
    sit: { x: anchor.x, y: anchor.y + sitSeatGap },
  })
  const table = createTableGeometry(tableId, anchor, tableRadius, tableApproach)
  return {
    groupId,
    anchor,
    table,
    seats: [top, bottom],
    bounds: unionCollisionBoxes([table.collision, top.collision, bottom.collision]),
  }
}

export function createFourSeatFurniture({
  groupId,
  anchor,
  tableId = groupId,
  seatIds = [`${groupId}-chair-top`, `${groupId}-chair-right`, `${groupId}-chair-bottom`, `${groupId}-chair-left`],
  tableApproach = { x: anchor.x, y: anchor.y - 7 },
  tableRadius = 4,
  seatGap = sharedFurnitureGeometry.seatGap,
  pulledSeatGap,
  sitSeatGap = seatGap + (sharedFurnitureGeometry.sitSeatGap - sharedFurnitureGeometry.seatGap),
  seatPairOffset = 3.4,
}: {
  groupId: string
  anchor: Point
  tableId?: string
  seatIds?: readonly [string, string, string, string]
  tableApproach?: Point
  tableRadius?: number
  seatGap?: number
  pulledSeatGap?: number
  sitSeatGap?: number
  seatPairOffset?: number
}): FourSeatFurniture {
  const gap = seatGap
  const pulledGap = Math.max(
    pulledSeatGap ?? seatGap + (sharedFurnitureGeometry.pulledSeatGap - sharedFurnitureGeometry.seatGap),
    seatGap + sharedFurnitureGeometry.textFootprint.width / 2 + sharedFurnitureGeometry.playerRadius + sharedFurnitureGeometry.actorContactGap,
  )
  const sitGap = sitSeatGap
  const topSeatY = anchor.y - seatPairOffset
  const bottomSeatY = anchor.y + seatPairOffset
  const seats = [
    createSeatGeometry({
      id: seatIds[0], tableId, side: 'left',
      rest: { x: anchor.x - gap, y: topSeatY },
      pulled: { x: anchor.x - pulledGap, y: topSeatY },
      sit: { x: anchor.x - sitGap, y: topSeatY },
    }),
    createSeatGeometry({
      id: seatIds[1], tableId, side: 'right',
      rest: { x: anchor.x + gap, y: topSeatY },
      pulled: { x: anchor.x + pulledGap, y: topSeatY },
      sit: { x: anchor.x + sitGap, y: topSeatY },
    }),
    createSeatGeometry({
      id: seatIds[2], tableId, side: 'left',
      rest: { x: anchor.x - gap, y: bottomSeatY },
      pulled: { x: anchor.x - pulledGap, y: bottomSeatY },
      sit: { x: anchor.x - sitGap, y: bottomSeatY },
    }),
    createSeatGeometry({
      id: seatIds[3], tableId, side: 'right',
      rest: { x: anchor.x + gap, y: bottomSeatY },
      pulled: { x: anchor.x + pulledGap, y: bottomSeatY },
      sit: { x: anchor.x + sitGap, y: bottomSeatY },
    }),
  ] as const
  const table = createTableGeometry(tableId, anchor, tableRadius, tableApproach)
  // A four-seat group is one physical table body, not two narrow tables with
  // a walkable seam between them. Its body spans both chair rows.
  table.collision = sharedTextFootprint(anchor, {
    width: sharedFurnitureGeometry.tableFootprint.wideWidth,
    height: seatPairOffset * 2 + sharedFurnitureGeometry.tableFootprint.height,
    padding: sharedFurnitureGeometry.tableFootprint.padding,
  })
  return {
    groupId,
    anchor,
    table,
    seats,
    bounds: unionCollisionBoxes([table.collision, ...seats.map((seat) => seat.collision)]),
  }
}
