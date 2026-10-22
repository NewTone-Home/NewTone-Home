import { describe, expect, it } from 'vitest'
import { mainlineScenes, mainlineCanonicalSceneGeometryUnits } from '../src/center/runtime/mainlineScenes'
import { findMainlinePath, findMainlinePathToEntity, isWalkableMainlinePoint, canTravelAlongMainlineSegment, resolveMainlineNpcPosition, resolveMainlineSafeSpawnPosition } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { commercialCafeLaoZhouConversationSeatId, commercialCafeStoryTableId } from '../src/center/runtime/commercialCafeStory'

const scene = mainlineScenes['commercial-street']
const units = mainlineCanonicalSceneGeometryUnits(scene, sceneDesignReferenceMetrics)
const shops = [
  { room: 'commercial-north-cafe-interior', prefix: 'cafe-trial-counter', counterX: 176, frontY: 496, wallX: 0, employee: 'cafe-coffee-owner', rearX: 84, menu: ['commercial-cafe-menu', 'commercial-cafe-blackboard'], service: ['commercial-cafe-counter', 'cafe-trial-order', 'cafe-trial-pickup'], equipment: ['cafe-trial-coffee-machine', 'cafe-trial-prep-table', 'cafe-trial-wash', 'cafe-trial-cold'], count: 39 },
  { room: 'commercial-south-s5-interior', prefix: 'milk-tea-trial', counterX: 208, frontY: 112, wallX: 336, employee: 'milk-tea-trial-worker', rearX: 280, menu: ['commercial-s5-milk-tea-menu-service-label'], service: ['commercial-s5-milk-tea-order-service-label', 'commercial-s5-milk-tea-pickup-service-label'], equipment: [1, 2, 3, 4].map(i => `milk-tea-trial-equipment-${i}`), count: 44 },
  { room: 'commercial-north-n1-interior', prefix: 'fruit-tea-trial', counterX: 128, frontY: 560, wallX: 0, employee: 'fruit-tea-trial-worker', rearX: 56, menu: ['fruit-tea-trial-menu'], service: ['fruit-tea-trial-order', 'fruit-tea-trial-pickup'], equipment: [1, 2, 3, 4, 5].map(i => `fruit-tea-trial-equipment-${i}`), count: 42 },
] as const
const options = (actorId = 'protagonist') => ({ screenMetrics: sceneDesignReferenceMetrics, actorId, actorFootprint: { width: (actorId === 'protagonist' ? 11 : 16) / 19.2, height: (actorId === 'protagonist' ? 11 : 16) / 10.8 } })

describe('drink shops correct the entrance-end counter and real work side', () => {
  for (const shop of shops) {
    const room = scene.rooms.find(r => r.id === shop.room)!
    const point = (x: number, y: number) => ({ x: room.bounds.x + x / 1920 * 100, y: room.bounds.y + y / 1080 * 100 })
    const local = (p: { x: number; y: number }) => ({ x: (p.x - room.bounds.x) * 19.2, y: (p.y - room.bounds.y) * 10.8 })
    const front = scene.passages.find(p => p.toRoomId === room.id && p.routeThrough)!
    const rear = scene.passages.find(p => p.id === `${room.id}-rear-door`)!
    const bodies = scene.continuousStructures.filter(b => b.id.startsWith(shop.prefix))
    const cells = scene.objects.filter(o => bodies.some(b => o.interactionStructureId === b.id))

    it(`${shop.room}: front arm closes toward the employee wall, not the customer centre`, () => {
      expect(bodies).toHaveLength(shop.employee==='cafe-coffee-owner'?3:2)
      expect(cells).toHaveLength(shop.count)
      expect(new Set(cells.map(c => `${c.position.x}:${c.position.y}`)).size).toBe(cells.length)
      const arm = cells.filter(c => Math.abs(local(c.position).y - shop.frontY) < .001)
      expect(arm.length).toBeGreaterThan(5)
      const xs = arm.map(c => local(c.position).x).sort((a, b) => a - b)
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(16, 5)
      expect(shop.wallX === 0 ? xs[0] : 336 - xs.at(-1)!).toBeCloseTo(16, 5)
      expect(Math.abs(local(front.crossingTargets[0]!).y - shop.frontY)).toBeLessThan(210)
      expect(cells.every(c => !['点单', '取餐', '取货'].includes(c.label))).toBe(true)
      for (const id of shop.service) expect(scene.objects.find(o => o.id === id)).toMatchObject({ interactive: true, label: expect.stringMatching(/^[柜台]$/) })
    })

    it(`${shop.room}: menu replaces wall cells without an opening or floor duplicate`, () => {
      for (const id of shop.menu) {
        const object = scene.objects.find(o => o.id === id)!
        expect(object).toMatchObject({ surface: 'wall', roomId: room.id, interactive: true })
        expect(scene.objects.filter(o => o.id === id)).toHaveLength(1)
        const paint = units.flatMap(u => u.visual.cells).filter(c => c.entityId === id)
        expect(paint.map(c => c.glyph).join('')).toBe(object.label)
        expect(paint).toHaveLength(Array.from(object.label).length)
        for (const cell of paint) {
          expect(cell.kind).toBe('feature')
          expect(units.flatMap(u => u.visual.cells).filter(c => Math.abs(c.x - cell.x) < .00001 && Math.abs(c.y - cell.y) < .00001 && c.glyph)).toHaveLength(1)
          expect(isWalkableMainlinePoint(cell, scene, {}, options())).toBe(false)
        }
        expect(findMainlinePathToEntity(scene, id, front.crossingTargets[0]!, {}, options()).path, id).not.toBeNull()
      }
    })

    it(`${shop.room}: retained service IDs stay reachable from the actual public doorway`, () => {
      for (const id of shop.service) expect(findMainlinePathToEntity(scene, id, front.crossingTargets[0]!, {}, options()).path, id).not.toBeNull()
      expect(front).toMatchObject({ access: 'open', routeThrough: true })
      expect(rear.access).toBe('locked')
      const glyphs = units.flatMap(u => u.visual.cells).filter(c => c.kind === 'door' && c.entityId === rear.id)
      expect(glyphs).toHaveLength(1)
      expect(local(glyphs[0]!).x).toBeCloseTo(shop.rearX, 3)
      // Original rear position becomes a solid ordinary wall, not a hidden door.
      expect(isWalkableMainlinePoint(point(room.bounds.width * 19.2 / 2, local(glyphs[0]!).y), scene, {}, options(shop.employee))).toBe(false)
    })

    it(`${shop.room}: a 16px employee can use equipment and the locked rear approach`, () => {
      const start = resolveMainlineNpcPosition(scene, shop.employee)
      expect(isWalkableMainlinePoint(start, scene, {}, options(shop.employee)), 'employee initial placement').toBe(true)
      for (const id of shop.equipment) {
        const object = scene.objects.find(o => o.id === id)!
        expect(object).toMatchObject({ interactive: true, surface: 'floor' })
        expect(scene.explorationText?.[id]?.length).toBeGreaterThan(0)
        const result = findMainlinePathToEntity(scene, id, start, {}, options(shop.employee))
        expect(result.path, id).not.toBeNull()
        for (let i = 1; i < (result.path?.length ?? 0); i++) expect(canTravelAlongMainlineSegment(result.path![i - 1]!, result.path![i]!, scene, {}, options(shop.employee))).toBe(true)
      }
      expect(findMainlinePath(start, rear.thresholds[0]!, scene, {}, options(shop.employee))).not.toBeNull()
      expect(isWalkableMainlinePoint(rear.thresholds[0]!, scene, {}, options())).toBe(false)
    })

    it(`${shop.room}: old counter-contact saves recover on the public side of the same room`, () => {
      const oldContact = shop.room.includes('cafe') ? point(181.5, 336) : shop.room.includes('s5') ? point(210.5, 528) : point(125.5, 448)
      const recovered = resolveMainlineSafeSpawnPosition(scene, oldContact, {}, options())!
      expect(recovered).not.toBeNull()
      expect(recovered.x).toBeGreaterThan(room.bounds.x)
      expect(recovered.x).toBeLessThan(room.bounds.x + room.bounds.width)
      expect(recovered.y).toBeGreaterThan(room.bounds.y)
      expect(recovered.y).toBeLessThan(room.bounds.y + room.bounds.height)
      expect(isWalkableMainlinePoint(recovered, scene, {}, options())).toBe(true)
      expect(findMainlinePath(recovered, front.crossingTargets[0]!, scene, {}, options())).not.toBeNull()
      expect(resolveMainlineSafeSpawnPosition(scene, recovered, {}, options())).toEqual(recovered)
    })
  }

  it('preserves Cafe story seats, toilet and coffee-order business behavior', () => {
    expect(scene.objects.find(o => o.id === commercialCafeLaoZhouConversationSeatId)?.seat?.tableId).toBe(commercialCafeStoryTableId)
    expect(scene.objects.find(o => o.id === 'commercial-cafe-counter')?.interactionBehavior).toBe('cafe-order')
    const toilet = scene.objects.find(o => o.id === 'cafe-trial-customer-toilet-door')!
    const room = scene.rooms.find(r => r.id === 'commercial-north-cafe-interior')!
    expect((toilet.position.x - room.bounds.x) * 19.2).toBeCloseTo(560, 3)
    expect(scene.passages.find(p => p.id === toilet.id)?.access).toBe('locked')
    expect(scene.objects.filter(o => o.roomId === room.id && o.seat)).toHaveLength(8)
  })
})
