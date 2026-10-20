import { describe, expect, it } from 'vitest'
import { mainlineEntityBelongsToActiveRoom, type MainlineSceneEntity } from '../src/center/runtime/mainlineSceneModel'
import { commercialCafeLaoZhouConversationSeatId, commercialCafeStoryTableId } from '../src/center/runtime/commercialCafeStory'
import { canTravelAlongMainlineSegment, findMainlinePath, findMainlinePathToEntity, isWalkableMainlinePoint, resolveMainlineSeatSitPosition } from '../src/center/runtime/mainlineNavigation'
import { mainlineSceneGeometryUnits, mainlineScenes, mainlineStorefrontApproach, validateMainlineSceneGeometry } from '../src/center/runtime/mainlineScenes'
import { boundaryGridStepsFromScreenSpacing } from '../src/center/runtime/sceneBoundaryGrid'

const street = mainlineScenes['commercial-street']
const sampleRoomIds = ['commercial-south-s5-interior', 'commercial-south-s2-interior'] as const
const northCafeRoomId = 'commercial-north-cafe-interior'
const steps = boundaryGridStepsFromScreenSpacing()

function localCell(roomId: string, point: { x: number; y: number }) {
  const room = street.rooms.find((candidate) => candidate.id === roomId)!
  return {
    column: (point.x - room.bounds.x) / steps.horizontal - 1,
    row: (point.y - room.bounds.y) / steps.vertical,
  }
}

function northCafeCell(column: number, row: number) {
  const room = street.rooms.find((candidate) => candidate.id === northCafeRoomId)!
  return { x: room.bounds.x + (column + 1) * steps.horizontal, y: room.bounds.y + room.bounds.height - row * steps.vertical }
}

function northCafeLocalCell(point: { x: number; y: number }) {
  const room = street.rooms.find((candidate) => candidate.id === northCafeRoomId)!
  return {
    column: Number(((point.x - room.bounds.x) / steps.horizontal - 1).toFixed(4)),
    row: Number(((room.bounds.y + room.bounds.height - point.y) / steps.vertical).toFixed(4)),
  }
}

function overlaps(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y
}

describe('commercial street shell furniture samples', () => {
  it('keeps the new Cafe furniture in the 25x26 north shell and preserves the legacy Cafe blueprint', () => {
    const shell = street.rooms.find((room) => room.id === northCafeRoomId)!
    const storefront = street.storefronts.find((slot) => slot.id === 'commercial-cafe-slot')!
    const shellObjects = street.objects.filter((entity) => entity.roomId === northCafeRoomId)
    const legacyCafe = mainlineScenes['commercial-cafe']
    const storyTable = legacyCafe.objects.find((entity) => entity.id === commercialCafeStoryTableId)!

    expect(storefront.composition?.baseline).toHaveLength(23)
    expect(storefront.composition?.near).toHaveLength(23)
    expect(shell.bounds.width).toBeCloseTo(steps.horizontal * 24)
    expect(shell.bounds.height).toBeCloseTo(steps.vertical * 25)
    expect(shellObjects.length).toBeGreaterThan(0)
    expect(shellObjects.every((entity) => entity.visualVisibility === 'static')).toBe(true)
    expect(shellObjects.every((entity) => entity.interactionBehavior === undefined)).toBe(true)
    expect(shellObjects.every((entity) => entity.id !== commercialCafeStoryTableId && entity.id !== commercialCafeLaoZhouConversationSeatId)).toBe(true)
    expect(street.npcs.some((npc) => npc.id === 'lao-zhou')).toBe(false)
    expect(street.furnitureGroups.filter((group) => group.id.startsWith('commercial-north-cafe-')).map((group) => group.id)).toEqual([
      'commercial-north-cafe-table-group-front',
      'commercial-north-cafe-table-group-middle',
      'commercial-north-cafe-table-group-rear',
    ])

    expect(legacyCafe.walkBounds).toEqual({ x: 8, y: 7, width: 90, height: 86 })
    expect(legacyCafe.furnitureGroups.map((group) => group.id)).toEqual([
      'commercial-cafe-bottom-left-group',
      'commercial-cafe-bottom-center-group',
      'commercial-cafe-bottom-right-group',
      'commercial-cafe-right-inner-upper-group',
      'commercial-cafe-right-inner-middle-group',
      'commercial-cafe-right-inner-lower-group',
      'commercial-cafe-right-window-upper-group',
      'commercial-cafe-right-window-lower-group',
    ])
    expect(storyTable.position).toEqual({ x: 84, y: 26 })
    expect(legacyCafe.objects.find((entity) => entity.id === commercialCafeLaoZhouConversationSeatId)?.seat?.tableId).toBe(storyTable.id)
    expect(legacyCafe.portals.map((portal) => [portal.id, portal.access])).toEqual([
      ['street-cafe-entry', 'open'],
      ['cafe-back-door', 'locked'],
    ])
  })

  it('adds three new two-seat groups at the requested shell cells with six new seat IDs', () => {
    const groupIds = [
      'commercial-north-cafe-table-group-front',
      'commercial-north-cafe-table-group-middle',
      'commercial-north-cafe-table-group-rear',
    ]
    const tables = street.objects.filter((entity) => entity.roomId === northCafeRoomId && entity.kind === 'table')
    const seats = street.objects.filter((entity) => entity.roomId === northCafeRoomId && entity.kind === 'seat')
    expect(tables.map((table) => [table.id, northCafeLocalCell(table.position).column, northCafeLocalCell(table.position).row])).toEqual([
      ['commercial-north-cafe-table-front', 15, 7],
      ['commercial-north-cafe-table-middle', 18, 11],
      ['commercial-north-cafe-table-rear', 15, 16],
    ])
    expect(seats).toHaveLength(6)
    expect(seats.map((seat) => seat.id).sort()).toEqual([
      'commercial-north-cafe-seat-front-a',
      'commercial-north-cafe-seat-front-b',
      'commercial-north-cafe-seat-middle-a',
      'commercial-north-cafe-seat-middle-b',
      'commercial-north-cafe-seat-rear-a',
      'commercial-north-cafe-seat-rear-b',
    ])
    for (const groupId of groupIds) {
      const groupSeats = seats.filter((seat) => seat.groupId === groupId)
      expect(groupSeats).toHaveLength(2)
      expect(tables.find((table) => table.id === `commercial-north-cafe-table-${groupId.split('-').at(-1)}`)).toBeDefined()
    }
    expect(seats.some((seat) => seat.id.includes('commercial-cafe-right-window'))).toBe(false)
  })

  it('keeps the Cafe counter, service labels, staff opening and open storage on distinct cells', () => {
    const counter = street.objects.filter((entity) => entity.roomId === northCafeRoomId && entity.id.startsWith('commercial-north-cafe-counter-'))
    const main = counter.filter((entity) => Math.abs(northCafeLocalCell(entity.position).row - 5) < .01)
      .sort((a, b) => northCafeLocalCell(a.position).column - northCafeLocalCell(b.position).column)
    const returned = counter.filter((entity) => Math.abs(northCafeLocalCell(entity.position).column - 9) < .01
      && northCafeLocalCell(entity.position).row >= 6 && northCafeLocalCell(entity.position).row <= 8)
      .sort((a, b) => northCafeLocalCell(a.position).row - northCafeLocalCell(b.position).row)
    const bodies = street.continuousStructures.filter((structure) => structure.kind === 'counter'
      && structure.id.startsWith('commercial-north-cafe-counter-'))

    expect(main.map((entity) => northCafeLocalCell(entity.position).column)).toEqual([4, 5, 6, 7, 8, 9])
    expect(returned).toHaveLength(3)
    expect(new Set(counter.map((entity) => `${northCafeLocalCell(entity.position).column}:${northCafeLocalCell(entity.position).row}`)).size).toBe(9)
    expect(counter.every((entity) => entity.interactive === false && entity.interactionBehavior === undefined && Array.from(entity.label).length === 1)).toBe(true)
    expect(bodies).toHaveLength(2)
    expect(overlaps(bodies[0]!, bodies[1]!)).toBe(true)

    const labels = street.objects.filter((entity) => entity.roomId === northCafeRoomId
      && (entity.id.startsWith('commercial-north-cafe-menu-label-')
        || entity.id.startsWith('commercial-north-cafe-order-label-')
        || entity.id.startsWith('commercial-north-cafe-storage-label-')))
    expect(labels.filter((entity) => entity.id.startsWith('commercial-north-cafe-menu-label-')).map((entity) => [entity.label, northCafeLocalCell(entity.position).column, northCafeLocalCell(entity.position).row])).toEqual([
      ['菜', 4, 3], ['单', 5, 3],
    ])
    expect(labels.filter((entity) => entity.id.startsWith('commercial-north-cafe-order-label-')).map((entity) => [entity.label, northCafeLocalCell(entity.position).column, northCafeLocalCell(entity.position).row])).toEqual([
      ['点', 6, 4], ['单', 7, 4],
    ])
    expect(labels.filter((entity) => entity.id.startsWith('commercial-north-cafe-storage-label-')).map((entity) => [entity.label, northCafeLocalCell(entity.position).column, northCafeLocalCell(entity.position).row])).toEqual([
      ['储', 2, 19], ['物', 3, 19],
    ])
    expect(labels.every((entity) => entity.interactive === false && entity.interactionBehavior === undefined && entity.visualVisibility === 'static')).toBe(true)
    const staffOpening = street.objects.find((entity) => entity.id === 'commercial-north-cafe-staff-opening')!
    expect(northCafeLocalCell(staffOpening.position)).toEqual({ column: 9, row: 9 })
    expect(staffOpening.interactionBehavior).toBeUndefined()
  })

  it('leaves all Cafe seats and the locked rear-door approach reachable', () => {
    const room = street.rooms.find((candidate) => candidate.id === northCafeRoomId)!
    const slot = street.storefronts.find((candidate) => candidate.id === 'commercial-cafe-slot')!
    const entry = mainlineStorefrontApproach(street, slot)
    const seats = street.objects.filter((entity) => entity.kind === 'seat' && entity.roomId === northCafeRoomId)
    const rear = street.passages.find((passage) => passage.id === `${northCafeRoomId}-rear-door`)!
    const staffArea = northCafeCell(6, 8)
    const staffOpening = northCafeCell(9, 9)

    expect(rear.access).toBe('locked')
    for (const seat of seats) {
      expect(findMainlinePathToEntity(street, seat.id, entry).path, seat.id).not.toBeNull()
      expect(resolveMainlineSeatSitPosition(street, seat.id)).not.toBeNull()
    }
    expect(findMainlinePath(entry, northCafeCell(6, 4), street)).not.toBeNull()
    expect(findMainlinePath(staffArea, staffOpening, street)).not.toBeNull()
    expect(findMainlinePath(staffOpening, rear.thresholds[0]!, street)).not.toBeNull()
    expect(findMainlinePath(northCafeCell(11, 19), rear.thresholds[0]!, street)).not.toBeNull()
    expect(room.id).toBe(northCafeRoomId)
  })

  it('keeps the existing milk-tea and fast-food furnishings scoped to their shells', () => {
    const scoped = street.objects.filter((entity) => sampleRoomIds.includes(entity.roomId as typeof sampleRoomIds[number]))
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
      'commercial-north-cafe-table-group-front',
      'commercial-north-cafe-table-group-middle',
      'commercial-north-cafe-table-group-rear',
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

  it('keeps the 13x26 milk-tea and 25x26 fast-food shells and both front/rear access states', () => {
    const steps = boundaryGridStepsFromScreenSpacing()
    for (const [roomId, columns] of [[sampleRoomIds[0], 11], [sampleRoomIds[1], 23]] as const) {
      const room = street.rooms.find((candidate) => candidate.id === roomId)!
      expect(room.bounds.width).toBeCloseTo(steps.horizontal * (columns + 1))
      expect(room.bounds.height).toBeCloseTo(steps.vertical * 25)
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
    const counters = street.objects.filter((entity) => ['柜台', '柜', '台'].includes(entity.label)
      && sampleRoomIds.includes(entity.roomId as typeof sampleRoomIds[number]))
    const bodies = street.continuousStructures.filter((structure) => structure.kind === 'counter'
      && (structure.id.startsWith('commercial-s5-milk-tea-counter-') || structure.id.startsWith('commercial-s2-fast-food-counter-')))
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
    expect(milkTeaCounter).toHaveLength(12)
    expect(fastFoodCounter).toHaveLength(10)
    expect(new Set(milkTeaCounter.map((entity) => `${entity.position.x}:${entity.position.y}`)).size).toBe(milkTeaCounter.length)
    const milkTeaVertical = bodies.find((body) => body.id === 'commercial-s5-milk-tea-counter-1-body')!
    const milkTeaHorizontal = bodies.find((body) => body.id === 'commercial-s5-milk-tea-counter-2-body')!
    expect(overlaps(milkTeaVertical, milkTeaHorizontal)).toBe(true)
    expect(milkTeaHorizontal.width).toBeCloseTo(3 * steps.horizontal)
    expect(milkTeaHorizontal.height).toBeCloseTo(steps.vertical)
    const horizontalMilkTeaGlyphs = milkTeaCounter.filter((entity) => entity.interactionStructureId === milkTeaHorizontal.id).sort((a, b) => a.position.x - b.position.x)
    expect(horizontalMilkTeaGlyphs.map((entity) => entity.label).join('')).toBe('柜台')
    expect(horizontalMilkTeaGlyphs.every((entity) => Array.from(entity.label).length === 1)).toBe(true)
    expect(horizontalMilkTeaGlyphs[1]!.position.x - horizontalMilkTeaGlyphs[0]!.position.x).toBeCloseTo(steps.horizontal)
    for (const glyph of horizontalMilkTeaGlyphs) {
      expect(glyph.position.x).toBeGreaterThanOrEqual(milkTeaHorizontal.x)
      expect(glyph.position.x).toBeLessThanOrEqual(milkTeaHorizontal.x + milkTeaHorizontal.width)
      expect(glyph.position.y).toBeGreaterThanOrEqual(milkTeaHorizontal.y)
      expect(glyph.position.y).toBeLessThanOrEqual(milkTeaHorizontal.y + milkTeaHorizontal.height)
    }
    expect(new Set(fastFoodCounter.map((entity) => entity.position.x)).size).toBe(1)
    expect(new Set(milkTeaCounter.map((entity) => entity.interactionStructureId)).size).toBe(2)
    expect(new Set(fastFoodCounter.map((entity) => entity.interactionStructureId)).size).toBe(1)
    const verticalMilkTea = milkTeaCounter.filter((entity) => Math.abs(localCell(sampleRoomIds[0], entity.position).column - 6) < 0.1).sort((a, b) => a.position.y - b.position.y)
    expect(verticalMilkTea.map((entity) => entity.label).join('')).toBe('柜台柜台柜台柜台柜台')
    const milkTeaRoom = street.rooms.find((candidate) => candidate.id === sampleRoomIds[0])!
    const milkTeaSlot = street.storefronts.find((candidate) => candidate.id === 'commercial-south-slot-5')!
    const eastEmployeeAisle = { x: milkTeaRoom.bounds.x + 8 * steps.horizontal, y: milkTeaRoom.bounds.y + 10 * steps.vertical }
    expect(findMainlinePath(mainlineStorefrontApproach(street, milkTeaSlot), eastEmployeeAisle, street), 'east employee aisle remains walkable beside the extended counter').not.toBeNull()
    expect(fastFoodCounter.sort((a, b) => a.position.y - b.position.y).map((entity) => entity.label).join('')).toBe('柜台'.repeat(5))
    const furniture = street.objects.filter((entity) => entity.roomId && (entity.kind === 'table' || entity.kind === 'seat') && entity.collision)
    const barriers = street.continuousStructures.filter((structure) => structure.kind === 'barrier'
      && (structure.id.includes('s5-milk-tea-') || structure.id.includes('s2-fast-food-')))
    for (const fixture of furniture) {
      for (const structure of [...bodies, ...barriers]) expect(overlaps(fixture.collision!, structure)).toBe(false)
    }
  })

  it('keeps internal wall glyphs collidable and leaves independent warehouse/kitchen door gaps', () => {
    const walls = street.objects.filter((entity) => entity.label === '墙' && entity.roomId
      && (entity.id.startsWith('commercial-s5-milk-tea-') || entity.id.startsWith('commercial-s2-fast-food-'))
      && (entity.id.includes('rear-partition-') || entity.id.includes('divider-')))
    const internalDoors = street.objects.filter((entity) => entity.label === '门'
      && sampleRoomIds.includes(entity.roomId as typeof sampleRoomIds[number]))
    expect(walls).toHaveLength(36)
    expect(internalDoors.map((entity) => entity.id).sort()).toEqual([
      'commercial-s2-fast-food-kitchen-door',
      'commercial-s2-fast-food-warehouse-door',
      'commercial-s5-milk-tea-kitchen-door',
      'commercial-s5-milk-tea-warehouse-door',
    ])
    expect(street.continuousStructures.filter((structure) => structure.kind === 'barrier'
      && (structure.id.includes('s5-milk-tea-') || structure.id.includes('s2-fast-food-')))).toHaveLength(8)
    expect(walls.every((wall) => !wall.collision)).toBe(true)
    expect(internalDoors.every((door) => !door.collision)).toBe(true)
    expect(street.blockers).toHaveLength(0)
    expect(validateMainlineSceneGeometry(street)).toEqual([])
  })

  it('keeps internal partition glyphs visible at the expanded shell edges without shortening collision runs', () => {
    const shellWallCells = mainlineSceneGeometryUnits(street, street.initialPlayerPosition)
      .filter((unit) => unit.sourceWallId?.endsWith('-shell'))
      .flatMap((unit) => unit.visual.cells)
      .filter((cell) => cell.kind === 'wall')
    const wallGlyphEntities = street.objects.filter((entity) => entity.roomId
      && (entity.id.includes('rear-partition-') || entity.id.includes('divider-')))
    const junctions = [
      [sampleRoomIds[0], 0, 16], [sampleRoomIds[0], 6, 16], [sampleRoomIds[0], 10, 16], [sampleRoomIds[0], 6, 21],
      [sampleRoomIds[1], 0, 16], [sampleRoomIds[1], 18, 16], [sampleRoomIds[1], 22, 16], [sampleRoomIds[1], 18, 21],
    ] as const

    for (const [roomId, column, row] of junctions) {
      const shellGlyphs = shellWallCells.filter((cell) => {
        const local = localCell(roomId, cell)
        return Math.abs(local.column - column) < 0.01 && Math.abs(local.row - row) < 0.01
      })
      const furnitureGlyphs = wallGlyphEntities.filter((entity) => entity.roomId === roomId
        && Math.abs(localCell(roomId, entity.position).column - column) < 0.01
        && Math.abs(localCell(roomId, entity.position).row - row) < 0.01)
      expect(shellGlyphs, `${roomId} extended shell at ${column},${row}`).toHaveLength(0)
      expect(furnitureGlyphs, `${roomId} internal partition at ${column},${row}`).toHaveLength(1)
      expect(shellGlyphs.length + furnitureGlyphs.length, `${roomId} unique wall glyph at ${column},${row}`).toBe(1)
    }

    const barriers = street.continuousStructures.filter((structure) => structure.kind === 'barrier'
      && (structure.id.includes('s5-milk-tea-') || structure.id.includes('s2-fast-food-')))
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
    const internalDoors = street.objects.filter((entity) => entity.id.endsWith('-door')
      && sampleRoomIds.includes(entity.roomId as typeof sampleRoomIds[number]))
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
    const seats = street.objects.filter((entity) => entity.kind === 'seat' && entity.seat
      && sampleRoomIds.includes(entity.roomId as typeof sampleRoomIds[number]))
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
