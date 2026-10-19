import { describe, expect, it } from 'vitest'
import { mainlineEntityBelongsToActiveRoom } from '../src/center/runtime/mainlineSceneModel'
import { findMainlinePath } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes, mainlineStorefrontApproach } from '../src/center/runtime/mainlineScenes'
import { boundaryGridStepsFromScreenSpacing } from '../src/center/runtime/sceneBoundaryGrid'

const street = mainlineScenes['commercial-street']
const steps = boundaryGridStepsFromScreenSpacing()

const retailStores = [
  { key: 'n2-creative', storefrontId: 'commercial-north-slot-2', roomId: 'commercial-north-n2-interior', counterRow: 8 },
  { key: 'n3-beauty', storefrontId: 'commercial-north-slot-3', roomId: 'commercial-north-n3-interior', counterRow: 10 },
  { key: 'n4-eyewear', storefrontId: 'commercial-north-slot-4', roomId: 'commercial-north-n4-interior', counterRow: 9 },
  { key: 'n5-toys', storefrontId: 'commercial-north-slot-5', roomId: 'commercial-north-n5-interior', counterRow: 9 },
  { key: 'n6-fragrance', storefrontId: 'commercial-north-slot-6', roomId: 'commercial-north-n6-interior', counterRow: 10 },
  { key: 's1-fashion', storefrontId: 'commercial-south-slot-1', roomId: 'commercial-south-s1-interior', counterRow: 11 },
  { key: 's4-clothing', storefrontId: 'commercial-south-slot-4', roomId: 'commercial-south-s4-interior', counterRow: 10 },
  { key: 's7-jewelry', storefrontId: 'commercial-south-slot-7', roomId: 'commercial-south-s7-interior', counterRow: 8 },
  { key: 's8-clothing', storefrontId: 'commercial-south-slot-8', roomId: 'commercial-south-s8-interior', counterRow: 9 },
] as const

function localCell(roomId: string, point: { x: number; y: number }) {
  const room = street.rooms.find((candidate) => candidate.id === roomId)!
  const storefront = street.storefronts.find((candidate) => candidate.id === retailStores.find((store) => store.roomId === roomId)!.storefrontId)!
  const localRowFromTop = (point.y - room.bounds.y) / steps.vertical
  return {
    column: (point.x - room.bounds.x) / steps.horizontal,
    row: storefront.edge === 'bottom' ? 21 - localRowFromTop : localRowFromTop,
  }
}

function storeCell(roomId: string, column: number, row: number) {
  const room = street.rooms.find((candidate) => candidate.id === roomId)!
  const storefront = street.storefronts.find((candidate) => candidate.id === retailStores.find((store) => store.roomId === roomId)!.storefrontId)!
  return {
    x: room.bounds.x + column * steps.horizontal,
    y: storefront.edge === 'bottom'
      ? room.bounds.y + (21 - row) * steps.vertical
      : room.bounds.y + row * steps.vertical,
  }
}

describe('commercial street ordinary retail shell fixtures', () => {
  it('adds static, room-scoped, one-character fixtures only to the nine requested stores', () => {
    const retail = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-'))
    expect(new Set(retail.map((entity) => entity.roomId))).toEqual(new Set(retailStores.map((store) => store.roomId)))
    expect(retail.every((entity) => entity.interactive === false && entity.visualVisibility === 'static')).toBe(true)
    expect(retail.every((entity) => Array.from(entity.label).length === 1)).toBe(true)
    expect(retail.every((entity) => ['架', '柜', '台', '墙', '储', '物'].includes(entity.label))).toBe(true)
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
      expect(room.bounds.width).toBeCloseTo(steps.horizontal * 10)
      expect(room.bounds.height).toBeCloseTo(steps.vertical * 21)

      const fixtures = street.objects.filter((entity) => entity.roomId === store.roomId && entity.id.startsWith('commercial-retail-'))
      expect(fixtures.some((entity) => {
        const { row } = localCell(store.roomId, entity.position)
        return row >= 2 && row <= 4
      }), `${store.key} entry rows 2–4 stay empty`).toBe(false)

      const entry = mainlineStorefrontApproach(street, storefront)
      const browsePoint = storeCell(store.roomId, 4, 7)
      const customerCounterPoint = storeCell(store.roomId, 7, store.counterRow + 0.5)
      const employeePoint = storeCell(store.roomId, 9, store.counterRow + 0.5)
      const storageLabel = street.objects.find((entity) => entity.id === `commercial-retail-${store.key}-storage-label-1`)!
      expect(findMainlinePath(entry, browsePoint, street), `${store.key} entry to browse`).not.toBeNull()
      expect(findMainlinePath(entry, customerCounterPoint, street), `${store.key} entry to counter customer side`).not.toBeNull()
      expect(findMainlinePath(browsePoint, employeePoint, street), `${store.key} east staff route`).not.toBeNull()
      expect(findMainlinePath(employeePoint, storageLabel.position, street), `${store.key} staff reaches storage`).not.toBeNull()
      expect(findMainlinePath(employeePoint, rear.thresholds[0]!, street), `${store.key} staff route to locked rear door`).not.toBeNull()
    }
  })

  it('matches every retail character fixture to continuous barrier collision while keeping counters two cells wide', () => {
    const retailRuns = street.continuousStructures.filter((structure) => structure.id.startsWith('commercial-retail-'))
    const retailEntities = street.objects.filter((entity) => entity.id.startsWith('commercial-retail-') && !entity.id.includes('-storage-label-'))
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
        .sort((a, b) => localCell(store.roomId, a.position).row - localCell(store.roomId, b.position).row)
      expect(counter.map((entity) => entity.label).join(''), store.key).toBe('柜台')
      expect(counter.every((entity) => Array.from(entity.label).length === 1)).toBe(true)
      expect(counter.every((entity) => Math.abs(localCell(store.roomId, entity.position).column - 8) < 0.01)).toBe(true)
      expect(Math.abs(localCell(store.roomId, counter[1]!.position).row - localCell(store.roomId, counter[0]!.position).row)).toBeCloseTo(1)
      const body = retailRuns.find((candidate) => candidate.id === `commercial-retail-${store.key}-counter-body`)!
      expect(body.height).toBeCloseTo(2 * steps.vertical)
    }
  })

  it('gives the nine businesses distinct display layouts without inventing stock or try-on interactions', () => {
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
