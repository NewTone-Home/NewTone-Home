import { describe, expect, it } from 'vitest'
import { mainlineEntityBelongsToActiveRoom, type MainlineSceneEntity } from '../src/center/runtime/mainlineSceneModel'
import { findMainlinePath } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes, mainlineStorefrontApproach, validateMainlineSceneGeometry } from '../src/center/runtime/mainlineScenes'
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
    expect(counters).toHaveLength(20)
    expect(bodies).toHaveLength(3)
    for (const counter of counters) {
      expect(counter.roomId).toMatch(/commercial-(south-s5|south-s2)-interior/)
      const body = bodies.find((candidate) => candidate.id.startsWith(counter.roomId === sampleRoomIds[0]
        ? 'commercial-s5-milk-tea-counter-'
        : 'commercial-s2-fast-food-counter-')
        && counter.position.x >= candidate.x && counter.position.x <= candidate.x + candidate.width
        && counter.position.y >= candidate.y && counter.position.y <= candidate.y + candidate.height)
      expect(body).toBeDefined()
    }
    const milkTeaCounter = counters.filter((entity) => entity.roomId === sampleRoomIds[0])
    const fastFoodCounter = counters.filter((entity) => entity.roomId === sampleRoomIds[1])
    expect(milkTeaCounter).toHaveLength(10)
    expect(fastFoodCounter).toHaveLength(10)
    expect(new Set(milkTeaCounter.map((entity) => entity.position.x)).size).toBe(2)
    expect(new Set(fastFoodCounter.map((entity) => entity.position.x)).size).toBe(1)
    const verticalMilkTea = milkTeaCounter.filter((entity) => entity.label !== '柜台').sort((a, b) => a.position.y - b.position.y)
    const milkTeaTurn = milkTeaCounter.filter((entity) => entity.label === '柜台')
    expect(verticalMilkTea.map((entity) => entity.label).join('')).toBe('柜台柜台柜台柜台柜')
    expect(milkTeaTurn).toHaveLength(1)
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
    expect(walls).toHaveLength(28)
    expect(internalDoors.map((entity) => entity.id).sort()).toEqual([
      'commercial-s2-fast-food-kitchen-door',
      'commercial-s2-fast-food-warehouse-door',
      'commercial-s5-milk-tea-kitchen-door',
      'commercial-s5-milk-tea-warehouse-door',
    ])
    expect(street.continuousStructures.filter((structure) => structure.kind === 'barrier')).toHaveLength(9)
    expect(walls.every((wall) => !wall.collision)).toBe(true)
    expect(internalDoors.every((door) => !door.collision)).toBe(true)
    expect(street.blockers).toHaveLength(0)
    expect(validateMainlineSceneGeometry(street)).toEqual([])
  })
})
