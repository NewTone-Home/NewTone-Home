import { describe, expect, it } from 'vitest'
import { mainlineEntityBelongsToActiveRoom } from '../src/center/runtime/mainlineSceneModel'
import { findMainlinePath } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes, mainlineStorefrontApproach } from '../src/center/runtime/mainlineScenes'
import { boundaryGridStepsFromScreenSpacing } from '../src/center/runtime/sceneBoundaryGrid'

const street = mainlineScenes['commercial-street']
const steps = boundaryGridStepsFromScreenSpacing()

const retailStores = [
  { key: 'n1-fruit-tea', storefrontId: 'commercial-north-slot-1', roomId: 'commercial-north-n1-interior', counterRow: 5, counterLength: 7 },
  { key: 'n2-creative', storefrontId: 'commercial-north-slot-2', roomId: 'commercial-north-n2-interior', counterRow: 9, counterLength: 4 },
  { key: 'n3-beauty', storefrontId: 'commercial-north-slot-3', roomId: 'commercial-north-n3-interior', counterRow: 8, counterLength: 5 },
  { key: 'n4-eyewear', storefrontId: 'commercial-north-slot-4', roomId: 'commercial-north-n4-interior', counterRow: 7, counterLength: 4 },
  { key: 'n5-toys', storefrontId: 'commercial-north-slot-5', roomId: 'commercial-north-n5-interior', counterRow: 7, counterLength: 4 },
  { key: 'n6-fragrance', storefrontId: 'commercial-north-slot-6', roomId: 'commercial-north-n6-interior', counterRow: 8, counterLength: 5 },
  { key: 's1-fashion', storefrontId: 'commercial-south-slot-1', roomId: 'commercial-south-s1-interior', counterRow: 8, counterLength: 5 },
  { key: 's4-clothing', storefrontId: 'commercial-south-slot-4', roomId: 'commercial-south-s4-interior', counterRow: 7, counterLength: 4 },
  { key: 's6-dessert', storefrontId: 'commercial-south-slot-6', roomId: 'commercial-south-s6-interior', counterRow: 6, counterLength: 5 },
  { key: 's7-jewelry', storefrontId: 'commercial-south-slot-7', roomId: 'commercial-south-s7-interior', counterRow: 8, counterLength: 4 },
  { key: 's8-clothing', storefrontId: 'commercial-south-slot-8', roomId: 'commercial-south-s8-interior', counterRow: 7, counterLength: 5 },
] as const

function localCell(roomId: string, point: { x: number; y: number }) {
  const room = street.rooms.find((candidate) => candidate.id === roomId)!
  const storefront = street.storefronts.find((candidate) => candidate.id === retailStores.find((store) => store.roomId === roomId)!.storefrontId)!
  const localRowFromTop = (point.y - room.bounds.y) / steps.vertical
  return {
    column: (point.x - room.bounds.x) / steps.horizontal - 1,
    row: storefront.edge === 'bottom' ? 25 - localRowFromTop : localRowFromTop,
  }
}

function storeCell(roomId: string, column: number, row: number) {
  const room = street.rooms.find((candidate) => candidate.id === roomId)!
  const storefront = street.storefronts.find((candidate) => candidate.id === retailStores.find((store) => store.roomId === roomId)!.storefrontId)!
  return {
    x: room.bounds.x + (column + 1) * steps.horizontal,
    y: storefront.edge === 'bottom'
      ? room.bounds.y + (25 - row) * steps.vertical
      : room.bounds.y + row * steps.vertical,
  }
}

describe('commercial street ordinary retail shell fixtures', () => {
  it('adds static, room-scoped, one-character fixtures only to the eleven selected storefronts', () => {
    const retail = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-'))
    expect(new Set(retail.map((entity) => entity.roomId))).toEqual(new Set(retailStores.map((store) => store.roomId)))
    expect(retail.every((entity) => entity.interactive === false && entity.visualVisibility === 'static')).toBe(true)
    expect(retail.every((entity) => Array.from(entity.label).length === 1)).toBe(true)
    expect(retail.every((entity) => ['架', '柜', '台', '墙', '储', '物', '点', '单', '取', '货', '菜', '整', '理'].includes(entity.label))).toBe(true)
    expect(street.npcs.map((npc) => npc.id).sort()).toEqual([
      'commercial-street-pedestrian-long',
      'commercial-street-pedestrian-mid-east-north',
      'commercial-street-pedestrian-mid-east-south',
      'commercial-street-pedestrian-shopper',
      'commercial-street-pedestrian-west-north',
      'commercial-street-pedestrian-west-south',
    ])

    for (const store of retailStores) {
      const fixtures = retail.filter((entity) => entity.roomId === store.roomId)
      expect(fixtures.length, store.key).toBeGreaterThan(0)
      expect(fixtures.every((entity) => mainlineEntityBelongsToActiveRoom(entity, store.roomId)), store.key).toBe(true)
      expect(fixtures.every((entity) => !mainlineEntityBelongsToActiveRoom(entity, undefined)), store.key).toBe(true)
      const occupied = fixtures.map((entity) => {
        const local = localCell(store.roomId, entity.position)
        expect(local.column, entity.id).toBeGreaterThanOrEqual(0)
        expect(local.column, entity.id).toBeLessThanOrEqual(10)
        expect(local.row, entity.id).toBeGreaterThanOrEqual(5)
        expect(local.row, entity.id).toBeLessThanOrEqual(19.01)
        return `${local.column.toFixed(2)}:${local.row.toFixed(2)}`
      })
      expect(new Set(occupied).size, `${store.key} has no glyph overlap`).toBe(occupied.length)
    }
  })

  it('keeps a clean entry, reachable browsing/counter/staff routes, and the locked rear threshold in all nine shells', () => {
    for (const store of retailStores) {
      const room = street.rooms.find((candidate) => candidate.id === store.roomId)!
      const storefront = street.storefronts.find((candidate) => candidate.id === store.storefrontId)!
      const front = street.passages.find((candidate) => candidate.portalId === storefront.portalId)!
      const rear = street.passages.find((candidate) => candidate.id === `${store.roomId}-rear-door`)!
      expect(front.access, `${store.key} front access`).toBe('open')
      expect(rear.access, `${store.key} rear stays locked`).toBe('locked')
      expect(room.bounds.width).toBeCloseTo(steps.horizontal * 12)
      expect(room.bounds.height).toBeCloseTo(steps.vertical * 25)

      const fixtures = street.objects.filter((entity) => entity.roomId === store.roomId && entity.id.startsWith('commercial-retail-'))
      expect(fixtures.some((entity) => {
        const { row } = localCell(store.roomId, entity.position)
        return row >= 2 && row <= 4
      }), `${store.key} entry rows 2–4 stay empty`).toBe(false)

      const entry = mainlineStorefrontApproach(street, storefront)
      const browsePoint = storeCell(store.roomId, 4, 7)
      const customerCounterPoint = storeCell(store.roomId, 7, store.counterRow + 0.5)
      const employeePoint = storeCell(store.roomId, 9, store.counterRow + store.counterLength + 0.5)
      const storageLabel = street.objects.find((entity) => entity.id === `commercial-retail-${store.key}-storage-label-1`)!
      expect(findMainlinePath(entry, browsePoint, street), `${store.key} entry to browse`).not.toBeNull()
      expect(findMainlinePath(entry, customerCounterPoint, street), `${store.key} entry to counter customer side`).not.toBeNull()
      expect(findMainlinePath(browsePoint, employeePoint, street), `${store.key} east staff route`).not.toBeNull()
      expect(findMainlinePath(employeePoint, storageLabel.position, street), `${store.key} staff reaches storage`).not.toBeNull()
      expect(findMainlinePath(employeePoint, rear.thresholds[0]!, street), `${store.key} staff route to locked rear door`).not.toBeNull()
    }
  })

  it('matches fixture glyphs to continuous barriers and keeps authored counter lengths with readable north/south order', () => {
    const retailRuns = street.continuousStructures.filter((structure) => structure.id.startsWith('commercial-retail-'))
    const retailEntities = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-') && entity.weight === 'fixture')
    expect(retailRuns.every((run) => run.kind === 'barrier')).toBe(true)
    for (const entity of retailEntities) {
      const runId = entity.id.replace(/-\d+$/, '')
      const body = retailRuns.find((candidate) => candidate.id === `${runId}-body`)
      expect(body, `${entity.id} has a continuous collision owner`).toBeDefined()
      expect(entity.position.x).toBeGreaterThanOrEqual(body!.x)
      expect(entity.position.x).toBeLessThanOrEqual(body!.x + body!.width)
      expect(entity.position.y).toBeGreaterThanOrEqual(body!.y)
      expect(entity.position.y).toBeLessThanOrEqual(body!.y + body!.height)
    }

    for (const store of retailStores) {
      const counter = street.objects.filter((entity) => entity.id.startsWith(`commercial-retail-${store.key}-counter-`))
        .sort((a, b) => a.position.y - b.position.y)
      const expected = Array.from({ length: store.counterLength }, (_, index) => index % 2 === 0 ? '柜' : '台').join('')
      expect(counter.map((entity) => entity.label).join(''), store.key).toBe(expected)
      expect(counter).toHaveLength(store.counterLength)
      expect(counter.every((entity) => Array.from(entity.label).length === 1)).toBe(true)
      expect(counter.every((entity) => Math.abs(localCell(store.roomId, entity.position).column - 8) < 0.01)).toBe(true)
      const rows = counter.map((entity) => localCell(store.roomId, entity.position).row).sort((a, b) => a - b)
      expect(rows.every((row, index) => index === 0 || Math.abs(row - rows[index - 1]! - 1) < 0.01)).toBe(true)
      const body = retailRuns.find((candidate) => candidate.id === `commercial-retail-${store.key}-counter-body`)!
      expect(body.height).toBeCloseTo(store.counterLength * steps.vertical)
    }
  })

  it('connects three open storage nooks to their side walls without double glyphs at corners', () => {
    for (const { key, roomId, storefrontId, side } of [
      { key: 'n2-creative', roomId: 'commercial-north-n2-interior', storefrontId: 'commercial-north-slot-2', side: 'west' },
      { key: 's4-clothing', roomId: 'commercial-south-s4-interior', storefrontId: 'commercial-south-slot-4', side: 'west' },
      { key: 's7-jewelry', roomId: 'commercial-south-s7-interior', storefrontId: 'commercial-south-slot-7', side: 'east' },
    ] as const) {
      const fixtures = street.objects.filter((entity) => entity.roomId === roomId && entity.id.startsWith(`commercial-retail-${key}-storage-`))
      const connector = street.continuousStructures.find((body) => body.id === `commercial-retail-${key}-storage-connector-body`)!
      const ret = street.continuousStructures.find((body) => body.id === `commercial-retail-${key}-storage-return-body`)!
      const sideCol = side === 'west' ? 0 : 10
      const innerCol = side === 'west' ? 2 : 8
      const elbow = storeCell(roomId, innerCol, 17)
      const sidePoint = storeCell(roomId, sideCol, 17)
      expect(fixtures.filter((entity) => Math.abs(entity.position.x - elbow.x) < 0.01 && Math.abs(entity.position.y - elbow.y) < 0.01)).toHaveLength(1)
      expect(fixtures.filter((entity) => Math.abs(entity.position.x - sidePoint.x) < 0.01 && Math.abs(entity.position.y - sidePoint.y) < 0.01)).toHaveLength(0)
      expect(connector.x).toBeLessThanOrEqual(sidePoint.x)
      expect(connector.x + connector.width).toBeGreaterThanOrEqual(sidePoint.x)
      expect(ret.x + ret.width / 2).toBeCloseTo(elbow.x, 1)
      const storage = street.objects.find((entity) => entity.id === `commercial-retail-${key}-storage-label-1`)!
      const entry = mainlineStorefrontApproach(street, street.storefronts.find((item) => item.id === storefrontId)!)
      expect(findMainlinePath(storeCell(roomId, 4, 7), storage.position, street), `${key} open nook route`).not.toBeNull()
      expect(findMainlinePath(entry, storage.position, street), `${key} entry to nook`).not.toBeNull()
    }
  })

  it('lays out the fruit-tea and dessert counters, customer service points, staff aisle and open rear storage', () => {
    const fruitTea = retailStores.find((store) => store.key === 'n1-fruit-tea')!
    const dessert = retailStores.find((store) => store.key === 's6-dessert')!
    for (const store of [fruitTea, dessert]) {
      const fixtureId = `commercial-retail-${store.key}-`
      const counter = street.objects.filter((entity) => entity.id.startsWith(`${fixtureId}counter-`))
      const counterCells = counter.map((entity) => localCell(store.roomId, entity.position))
      expect(counterCells).toHaveLength(store.counterLength)
      expect(counterCells.every(({ column }) => Math.abs(column - 8) < 0.01)).toBe(true)
      const staffAccess = storeCell(store.roomId, 9, store.counterRow + store.counterLength + 0.5)
      for (let offset = 0; offset < store.counterLength; offset += 1) {
        const staffWorkCell = storeCell(store.roomId, 9, store.counterRow + offset)
        expect(findMainlinePath(staffAccess, staffWorkCell, street), `${store.key} east staff cell ${offset + 1}`).not.toBeNull()
      }

      const storefront = street.storefronts.find((candidate) => candidate.id === store.storefrontId)!
      const entry = mainlineStorefrontApproach(street, storefront)
      const storage = street.objects.filter((entity) => entity.id.startsWith(`${fixtureId}storage-label-`))
      expect(storage).toHaveLength(2)
      expect(storage.map((entity) => Math.round(localCell(store.roomId, entity.position).column)).sort((a, b) => a - b)).toEqual([7, 8])
      expect(storage.every((entity) => Math.abs(localCell(store.roomId, entity.position).row - 18) < 0.01)).toBe(true)
      expect(findMainlinePath(entry, storeCell(store.roomId, 5, 14), street), `${store.key} customer browse aisle`).not.toBeNull()
      const rear = street.passages.find((passage) => passage.id === `${store.roomId}-rear-door`)!
      expect(rear.access).toBe('locked')
      expect(findMainlinePath(staffAccess, rear.thresholds[0]!, street), `${store.key} reaches locked rear`).not.toBeNull()
    }

    const fruitFixtures = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-n1-fruit-tea-'))
    expect(fruitFixtures.filter((entity) => entity.id.startsWith('commercial-retail-n1-fruit-tea-display-'))).toHaveLength(0)
    const fruitCounter = fruitFixtures.filter((entity) => entity.id.startsWith('commercial-retail-n1-fruit-tea-counter-'))
      .sort((a, b) => a.position.y - b.position.y)
    expect(fruitCounter.map((entity) => entity.label).join('')).toBe('柜台柜台柜台柜')
    for (const [marker, expectedText, row] of [['order', '点单', 5], ['pickup', '取货', 9]] as const) {
      const glyphs = fruitFixtures.filter((entity) => entity.id.startsWith(`commercial-retail-n1-fruit-tea-${marker}-`))
        .sort((a, b) => a.position.x - b.position.x)
      expect(glyphs.map((entity) => entity.label).join('')).toBe(expectedText)
      expect(glyphs.every((entity) => Math.abs(localCell(fruitTea.roomId, entity.position).row - row) < 0.01)).toBe(true)
    }

    const dessertFixtures = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-s6-dessert-'))
    const dessertDisplays = dessertFixtures.filter((entity) => entity.id.includes('-display-')).map((entity) => localCell(dessert.roomId, entity.position))
    expect(dessertDisplays).toHaveLength(9)
    expect(dessertDisplays.every(({ column, row }) => column >= 1.99 && column <= 4.01 && row >= 5.99 && row <= 10.01)).toBe(true)
    expect(dessertDisplays.some(({ column }) => column >= 5 && column <= 7)).toBe(false)
    for (const [marker, expectedText, row] of [['menu', '菜单', 6], ['pickup', '取货', 9], ['organization', '整理', 17]] as const) {
      const glyphs = dessertFixtures.filter((entity) => entity.id.startsWith(`commercial-retail-s6-dessert-${marker}-`))
        .sort((a, b) => a.position.x - b.position.x)
      expect(glyphs.map((entity) => entity.label).join('')).toBe(expectedText)
      expect(glyphs.every((entity) => Math.abs(localCell(dessert.roomId, entity.position).row - row) < 0.01)).toBe(true)
    }
    expect(dessertFixtures.some((entity) => /烤|炉|厨房|价格|购买/.test(entity.label))).toBe(false)
  })

  it('gives the selected businesses distinct display layouts without inventing stock or try-on interactions', () => {
    const layouts = retailStores.map((store) => street.objects
      .filter((entity) => entity.roomId === store.roomId && entity.id.includes('-display-'))
      .map((entity) => `${localCell(store.roomId, entity.position).column.toFixed(1)}:${localCell(store.roomId, entity.position).row.toFixed(1)}`)
      .sort().join('|'))
    expect(new Set(layouts).size).toBe(retailStores.length)
    const creative = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-n2-creative-display-central-group-'))
    expect(creative).toHaveLength(4)
    const toys = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-n5-toys-display-'))
    expect(toys).toHaveLength(4)
    expect(toys.every((entity) => ['架'].includes(entity.label) && entity.interactive === false)).toBe(true)
    const retailLabels = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-')).map((entity) => entity.label)
    expect(retailLabels.some((label) => /试衣|试用|香水|价格|商品|项链/.test(label))).toBe(false)
  })
})
