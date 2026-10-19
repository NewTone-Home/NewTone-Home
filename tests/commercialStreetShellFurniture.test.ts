import { describe, expect, it } from 'vitest'
import { mainlineEntityBelongsToActiveRoom, type MainlineSceneEntity } from '../src/center/runtime/mainlineSceneModel'
import { canTravelAlongMainlineSegment, findMainlinePath, findMainlinePathToEntity, isWalkableMainlinePoint, resolveMainlineSeatSitPosition } from '../src/center/runtime/mainlineNavigation'
import { mainlineSceneGeometryUnits, mainlineScenes, mainlineStorefrontApproach, validateMainlineSceneGeometry } from '../src/center/runtime/mainlineScenes'
import { boundaryGridStepsFromScreenSpacing } from '../src/center/runtime/sceneBoundaryGrid'

const street = mainlineScenes['commercial-street']
const sampleRoomIds = ['commercial-south-s5-interior', 'commercial-south-s2-interior'] as const
const steps = boundaryGridStepsFromScreenSpacing()

function localCell(roomId: string, point: { x: number; y: number }) {
  const room = street.rooms.find((candidate) => candidate.id === roomId)!
  return {
    column: (point.x - room.bounds.x) / steps.horizontal,
    row: (point.y - room.bounds.y) / steps.vertical,
  }
}

function overlaps(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y
}

describe('commercial street shell furniture samples', () => {
  it('adds room-scoped furnishings only to the milk-tea and fast-food shells', () => {
    const scoped = street.objects.filter((entity) => entity.roomId)
    expect(new Set(scoped.map((entity) => entity.roomId))).toEqual(new Set(sampleRoomIds))
    expect(scoped.every((entity) => entity.visible !== false)).toBe(true)

    const milkTeaTables = scoped.filter((entity) => entity.roomId === sampleRoomIds[0] && entity.kind === 'table')
    const fastFoodTables = scoped.filter((entity) => entity.roomId === sampleRoomIds[1] && entity.kind === 'table')
    expect(milkTeaTables).toHaveLength(1)
    expect(fastFoodTables).toHaveLength(2)
    expect(street.furnitureGroups.map((group) => group.id)).toEqual([
      'commercial-s5-milk-tea-table-group',
      'commercial-s2-fast-food-table-group-a',
      'commercial-s2-fast-food-table-group-b',
    ])
    for (const entity of scoped.filter((candidate) => candidate.kind === 'table' || candidate.kind === 'seat')) {
      const local = localCell(entity.roomId!, entity.position)
      if (entity.roomId === sampleRoomIds[0]) {
        expect(local.column).toBeGreaterThanOrEqual(1.8)
        expect(local.column).toBeLessThanOrEqual(5.2)
        expect(local.row).toBeGreaterThanOrEqual(4)
        expect(local.row).toBeLessThanOrEqual(15)
      } else {
        expect(local.column).toBeGreaterThanOrEqual(2)
        expect(local.column).toBeLessThanOrEqual(13)
        expect(local.row).toBeGreaterThanOrEqual(3)
        expect(local.row).toBeLessThanOrEqual(15)
      }
    }

    const unscoped = { id: 'ordinary-store-fixture', label: '窗', kind: 'fixture', weight: 'fixture', surface: 'floor', position: { x: 0, y: 0 } } as MainlineSceneEntity
    expect(mainlineEntityBelongsToActiveRoom(unscoped, undefined)).toBe(true)
    expect(mainlineEntityBelongsToActiveRoom(scoped[0], scoped[0].roomId)).toBe(true)
    expect(mainlineEntityBelongsToActiveRoom(scoped[0], sampleRoomIds[1])).toBe(false)
    expect(mainlineEntityBelongsToActiveRoom(scoped[0], undefined)).toBe(false)
  })

  it('keeps the 11x22 milk-tea and 23x22 fast-food grids and both front/rear access states', () => {
    const steps = boundaryGridStepsFromScreenSpacing()
    for (const [roomId, columns] of [[sampleRoomIds[0], 11], [sampleRoomIds[1], 23]] as const) {
      const room = street.rooms.find((candidate) => candidate.id === roomId)!
      expect(room.bounds.width).toBeCloseTo(steps.horizontal * (columns - 1))
      expect(room.bounds.height).toBeCloseTo(steps.vertical * 21)
      const slotNumber = roomId.includes('-s5-') ? '5' : '2'
      const storefront = street.storefronts.find((candidate) => candidate.id === `commercial-south-slot-${slotNumber}`)!
      const front = street.passages.find((candidate) => candidate.portalId === storefront.portalId)!
      const rear = street.passages.find((candidate) => candidate.id === `${roomId}-rear-door`)!
      expect(front.access).toBe('open')
      expect(front.routeThrough).toBe(true)
      expect(front.toRoomId).toBe(roomId)
      expect(rear.access).toBe('locked')
    }
  })

  it('leaves the locked rear-door approaches reachable through the staff-side partition openings', () => {
    for (const roomId of sampleRoomIds) {
      const room = street.rooms.find((candidate) => candidate.id === roomId)!
      const rear = street.passages.find((candidate) => candidate.id === `${roomId}-rear-door`)!
      const interior = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
      expect(findMainlinePath(interior, rear.thresholds[0], street), `${roomId} to rear threshold`).not.toBeNull()
    }
  })

  it('keeps a walkable customer-to-staff aisle beside each counter', () => {
    for (const [roomId, slotId, staffColumn] of [
      [sampleRoomIds[0], 'commercial-south-slot-5', 8],
      [sampleRoomIds[1], 'commercial-south-slot-2', 17],
    ] as const) {
      const room = street.rooms.find((candidate) => candidate.id === roomId)!
      const slot = street.storefronts.find((candidate) => candidate.id === slotId)!
      const staffAisle = { x: room.bounds.x + staffColumn * steps.horizontal, y: room.bounds.y + 10 * steps.vertical }
      expect(findMainlinePath(mainlineStorefrontApproach(street, slot), staffAisle, street), `${roomId} entry-to-staff aisle`).not.toBeNull()
    }
  })

  it('renders repeated cabinet glyphs over matching continuous counter collision segments', () => {
    const counters = street.objects.filter((entity) => ['柜台', '柜', '台'].includes(entity.label))
    const bodies = street.continuousStructures.filter((structure) => structure.kind === 'counter')
    expect(bodies).toHaveLength(3)
    for (const counter of counters) {
      expect(counter.roomId).toMatch(/commercial-(south-s5|south-s2)-interior/)
      expect(counter.interactionStructureId).toBeDefined()
      const body = bodies.find((candidate) => candidate.id.startsWith(counter.roomId === sampleRoomIds[0]
        ? 'commercial-s5-milk-tea-counter-'
        : 'commercial-s2-fast-food-counter-')
        && counter.position.x >= candidate.x && counter.position.x <= candidate.x + candidate.width
        && counter.position.y >= candidate.y && counter.position.y <= candidate.y + candidate.height)
      expect(body).toBeDefined()
      expect(counter.interactionStructureId).toBe(body?.id)
    }
    const milkTeaCounter = counters.filter((entity) => entity.roomId === sampleRoomIds[0])
    const fastFoodCounter = counters.filter((entity) => entity.roomId === sampleRoomIds[1])
    expect(milkTeaCounter).toHaveLength(11)
    expect(fastFoodCounter).toHaveLength(10)
    expect(new Set(milkTeaCounter.map((entity) => `${entity.position.x}:${entity.position.y}`)).size).toBe(milkTeaCounter.length)
    const milkTeaVertical = bodies.find((body) => body.id === 'commercial-s5-milk-tea-counter-1-body')!
    const milkTeaHorizontal = bodies.find((body) => body.id === 'commercial-s5-milk-tea-counter-2-body')!
    expect(overlaps(milkTeaVertical, milkTeaHorizontal)).toBe(true)
    expect(milkTeaHorizontal.width).toBeCloseTo(2 * steps.horizontal)
    expect(milkTeaHorizontal.height).toBeCloseTo(steps.vertical)
    expect(milkTeaCounter.filter((entity) => entity.label === '柜台')).toHaveLength(1)
    expect(milkTeaCounter.find((entity) => entity.label === '柜台')!.position.x).toBeGreaterThan(milkTeaHorizontal.x)
    expect(new Set(fastFoodCounter.map((entity) => entity.position.x)).size).toBe(1)
    expect(new Set(milkTeaCounter.map((entity) => entity.interactionStructureId)).size).toBe(2)
    expect(new Set(fastFoodCounter.map((entity) => entity.interactionStructureId)).size).toBe(1)
    const verticalMilkTea = milkTeaCounter.filter((entity) => Math.abs(localCell(sampleRoomIds[0], entity.position).column - 6) < 0.1).sort((a, b) => a.position.y - b.position.y)
    expect(verticalMilkTea.map((entity) => entity.label).join('')).toBe('柜台柜台柜台柜台柜台')
    expect(fastFoodCounter.sort((a, b) => a.position.y - b.position.y).map((entity) => entity.label).join('')).toBe('柜台'.repeat(5))
    const furniture = street.objects.filter((entity) => entity.roomId && (entity.kind === 'table' || entity.kind === 'seat') && entity.collision)
    const barriers = street.continuousStructures.filter((structure) => structure.kind === 'barrier')
    for (const fixture of furniture) {
      for (const structure of [...bodies, ...barriers]) expect(overlaps(fixture.collision!, structure)).toBe(false)
    }
  })

  it('keeps internal wall glyphs collidable and leaves independent warehouse/kitchen door gaps', () => {
    const walls = street.objects.filter((entity) => entity.label === '墙' && entity.roomId)
    const internalDoors = street.objects.filter((entity) => entity.label === '门' && entity.roomId)
    expect(walls).toHaveLength(30)
    expect(internalDoors.map((entity) => entity.id).sort()).toEqual([
      'commercial-s2-fast-food-kitchen-door',
      'commercial-s2-fast-food-warehouse-door',
      'commercial-s5-milk-tea-kitchen-door',
      'commercial-s5-milk-tea-warehouse-door',
    ])
    expect(street.continuousStructures.filter((structure) => structure.kind === 'barrier')).toHaveLength(8)
    expect(walls.every((wall) => !wall.collision)).toBe(true)
    expect(internalDoors.every((door) => !door.collision)).toBe(true)
    expect(street.blockers).toHaveLength(0)
    expect(validateMainlineSceneGeometry(street)).toEqual([])
  })

  it('draws one glyph at each shared shell/furniture wall junction without shortening collision runs', () => {
    const shellWallCells = mainlineSceneGeometryUnits(street, street.initialPlayerPosition)
      .filter((unit) => unit.sourceWallId?.endsWith('-shell'))
      .flatMap((unit) => unit.visual.cells)
      .filter((cell) => cell.kind === 'wall')
    const wallGlyphEntities = street.objects.filter((entity) => entity.roomId
      && (entity.id.includes('rear-partition-') || entity.id.includes('divider-')))
    const junctions = [
      [sampleRoomIds[0], 0, 16, true], [sampleRoomIds[0], 6, 16, false], [sampleRoomIds[0], 10, 16, true], [sampleRoomIds[0], 6, 21, true],
      [sampleRoomIds[1], 0, 16, true], [sampleRoomIds[1], 18, 16, false], [sampleRoomIds[1], 22, 16, true], [sampleRoomIds[1], 18, 21, true],
    ] as const

    for (const [roomId, column, row, shellOwnsGlyph] of junctions) {
      const shellGlyphs = shellWallCells.filter((cell) => {
        const local = localCell(roomId, cell)
        return Math.abs(local.column - column) < 0.01 && Math.abs(local.row - row) < 0.01
      })
      const furnitureGlyphs = wallGlyphEntities.filter((entity) => entity.roomId === roomId
        && Math.abs(localCell(roomId, entity.position).column - column) < 0.01
        && Math.abs(localCell(roomId, entity.position).row - row) < 0.01)
      expect(shellGlyphs, `${roomId} shell ownership at ${column},${row}`).toHaveLength(shellOwnsGlyph ? 1 : 0)
      expect(furnitureGlyphs, `${roomId} furniture ownership at ${column},${row}`).toHaveLength(shellOwnsGlyph ? 0 : 1)
      expect(shellGlyphs.length + furnitureGlyphs.length, `${roomId} unique wall glyph at ${column},${row}`).toBe(1)
    }

    const barriers = street.continuousStructures.filter((structure) => structure.kind === 'barrier')
    expect(barriers).toHaveLength(8)
    for (const [id, length] of [
      ['commercial-s5-milk-tea-kitchen-divider-body', 6],
      ['commercial-s2-fast-food-kitchen-warehouse-divider-body', 6],
      ['commercial-s5-milk-tea-rear-partition-0-body', 3],
      ['commercial-s5-milk-tea-rear-partition-1-body', 3],
      ['commercial-s5-milk-tea-rear-partition-2-body', 1],
      ['commercial-s2-fast-food-rear-partition-0-body', 16],
      ['commercial-s2-fast-food-rear-partition-1-body', 2],
      ['commercial-s2-fast-food-rear-partition-2-body', 1],
    ] as const) {
      const body = barriers.find((candidate) => candidate.id === id)!
      const expected = id.includes('divider') ? length * steps.vertical : length * steps.horizontal
      expect(id.includes('divider') ? body.height : body.width, id).toBeCloseTo(expected)
    }
  })

  it('keeps rear partitions sealed except at the two marked staff door openings', () => {
    for (const [roomId, doorCols, closedCol] of [
      [sampleRoomIds[0], [3.5, 8.5], 1.5],
      [sampleRoomIds[1], [16.5, 20.5], 12.5],
    ] as const) {
      const room = street.rooms.find((candidate) => candidate.id === roomId)!
      const fromFor = (column: number, row: number) => ({ x: room.bounds.x + column * steps.horizontal, y: room.bounds.y + row * steps.vertical })
      for (const doorCol of doorCols) {
        const route = findMainlinePath(fromFor(doorCol, 15), fromFor(doorCol, 17), street)
        expect(route, `${roomId}, marked staff doorway at col ${doorCol}`).not.toBeNull()
        const crossings = route!.slice(1).flatMap((point, index) => {
          const previous = route![index]!
          if ((previous.y - room.bounds.y - 16 * steps.vertical) * (point.y - room.bounds.y - 16 * steps.vertical) > 0) return []
          if (previous.y === point.y) return []
          const ratio = (room.bounds.y + 16 * steps.vertical - previous.y) / (point.y - previous.y)
          return [{ x: previous.x + ratio * (point.x - previous.x) }]
        })
        expect(crossings.length, `${roomId} must cross its back-of-house partition`).toBeGreaterThan(0)
        for (const crossing of crossings) {
          const column = (crossing.x - room.bounds.x) / steps.horizontal
          expect(doorCols.some((allowed) => Math.abs(column - allowed) <= 0.6), `${roomId} crossing at col ${column}`).toBe(true)
        }
      }
      const blockedCrossing = [fromFor(closedCol, 15.5), fromFor(closedCol, 16.5)]
      expect(canTravelAlongMainlineSegment(blockedCrossing[0], blockedCrossing[1], street), `${roomId} wall remains closed away from doors`).toBe(false)

      const dividerId = roomId === sampleRoomIds[0]
        ? 'commercial-s5-milk-tea-kitchen-divider-body'
        : 'commercial-s2-fast-food-kitchen-warehouse-divider-body'
      const divider = street.continuousStructures.find((structure) => structure.id === dividerId)!
      const localTop = (divider.y - room.bounds.y) / steps.vertical
      const localBottom = (divider.y + divider.height - room.bounds.y) / steps.vertical
      expect(localTop).toBeCloseTo(15.5)
      expect(localBottom).toBeCloseTo(21.5)
      const rear = street.passages.find((passage) => passage.id === `${roomId}-rear-door`)!
      const interior = fromFor(roomId === sampleRoomIds[0] ? 3.5 : 16.5, 17)
      expect(findMainlinePath(interior, rear.thresholds[0], street), `${roomId} rear-door threshold`).not.toBeNull()
    }
  })

  it('labels the independent kitchen and warehouse areas without changing the shared door label', () => {
    const signs = street.objects.filter((entity) => entity.id.endsWith('-sign'))
    expect(signs.map((entity) => entity.label).sort()).toEqual(['仓库', '仓库', '厨房', '厨房'])
    expect(signs.every((entity) => entity.interactive === false && entity.roomId)).toBe(true)
    const internalDoors = street.objects.filter((entity) => entity.id.endsWith('-door') && entity.roomId)
    expect(internalDoors).toHaveLength(4)
    expect(internalDoors.every((entity) => entity.label === '门')).toBe(true)
    for (const sign of signs) {
      const overlapsNearbyLabel = street.objects.some((entity) => entity.roomId === sign.roomId && entity.id !== sign.id
        && Math.abs(entity.position.y - sign.position.y) < steps.vertical * .75
        && Math.abs(entity.position.x - sign.position.x) < steps.horizontal * 1.4)
      expect(overlapsNearbyLabel, `${sign.id} has clear text space`).toBe(false)
    }
  })

  it('places menu, order and pickup labels separately on the customer side', () => {
    const serviceLabels = street.objects.filter((entity) => entity.id.endsWith('-service-label'))
    expect(serviceLabels).toHaveLength(6)
    expect(serviceLabels.map((entity) => entity.label).sort()).toEqual(['取餐', '取餐', '点单', '点单', '菜单', '菜单'])
    expect(serviceLabels.every((entity) => entity.interactive === false && entity.visualVisibility === 'static')).toBe(true)
    for (const [roomId, slotId, counterColumn] of [
      [sampleRoomIds[0], 'commercial-south-slot-5', 6],
      [sampleRoomIds[1], 'commercial-south-slot-2', 14],
    ] as const) {
      const slot = street.storefronts.find((candidate) => candidate.id === slotId)!
      const entry = mainlineStorefrontApproach(street, slot)
      const labels = serviceLabels.filter((entity) => entity.roomId === roomId)
      expect(labels).toHaveLength(3)
      expect(labels.every((entity) => localCell(roomId, entity.position).column < counterColumn)).toBe(true)
      for (const label of labels) {
        expect(findMainlinePath(entry, label.position, street), `${label.id} is reachable from the customer entry`).not.toBeNull()
        const overlapsNearbyLabel = street.objects.some((entity) => entity.roomId === roomId && entity.id !== label.id
          && Math.abs(entity.position.y - label.position.y) < steps.vertical * .75
          && Math.abs(entity.position.x - label.position.x) < steps.horizontal * 1.4)
        expect(overlapsNearbyLabel, `${label.id} has clear text space`).toBe(false)
      }
      const order = labels.find((entity) => entity.id.includes('-order-'))!
      const pickup = labels.find((entity) => entity.id.includes('-pickup-'))!
      expect(Math.abs(localCell(roomId, order.position).row - localCell(roomId, pickup.position).row)).toBeGreaterThan(3)
    }
  })

  it('keeps each chair rest, pull, sit and stand-up approach reachable in all three groups', () => {
    const tableEntryByGroup = new Map([
      ['commercial-s5-milk-tea-table-group', 'commercial-south-slot-5'],
      ['commercial-s2-fast-food-table-group-a', 'commercial-south-slot-2'],
      ['commercial-s2-fast-food-table-group-b', 'commercial-south-slot-2'],
    ])
    const seats = street.objects.filter((entity) => entity.kind === 'seat' && entity.seat && entity.roomId)
    expect(seats).toHaveLength(6)
    for (const seat of seats) {
      const slotId = tableEntryByGroup.get(seat.groupId!)!
      const slot = street.storefronts.find((candidate) => candidate.id === slotId)!
      const start = mainlineStorefrontApproach(street, slot)
      const { rest, pulled, sit } = seat.seat!
      const sitPosition = resolveMainlineSeatSitPosition(street, seat.id)!
      const seatApproach = findMainlinePathToEntity(street, seat.id, start)
      expect(seatApproach.path, `${seat.id} chair interaction can be approached`).not.toBeNull()
      expect(rest).toEqual(seat.position)
      expect(seat.approach).toEqual(pulled)
      expect(isWalkableMainlinePoint(seatApproach.target, street), `${seat.id} pull contact`).toBe(true)
      expect(sitPosition).toEqual(seat.position)
      expect(sit).toBeDefined()
      const seatedOptions = { occupiedSeatIds: new Set([seat.id]) }
      expect(findMainlinePath(seatApproach.target, sitPosition, street, {}, seatedOptions), `${seat.id} can sit from its pull contact`).not.toBeNull()
      expect(findMainlinePath(sitPosition, start, street, {}, seatedOptions), `${seat.id} can stand and reach the entry`).not.toBeNull()
    }
  })
})
