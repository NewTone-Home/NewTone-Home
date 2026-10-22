import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { findMainlinePath, findMainlinePathToEntity, isWalkableMainlinePoint, resolveMainlineNpcPosition, resolveMainlineSafeSpawnPosition } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { commercialCafeLaoZhouConversationSeatId, commercialCafeStoryTableId } from '../src/center/runtime/commercialCafeStory'

const scene = mainlineScenes['commercial-street']
const shops = [
  { room: 'commercial-north-cafe-interior', prefix: 'cafe-trial-', worker: 'cafe-coffee-owner', services: ['commercial-cafe-counter', 'cafe-trial-order', 'cafe-trial-pickup'], equipment: ['cafe-trial-coffee-machine', 'cafe-trial-prep-table', 'cafe-trial-wash', 'cafe-trial-cold'] },
  { room: 'commercial-south-s5-interior', prefix: 'milk-tea-trial-', worker: 'milk-tea-trial-worker', services: ['commercial-s5-milk-tea-order-service-label', 'commercial-s5-milk-tea-pickup-service-label'], equipment: [1, 2, 3, 4].map(i => `milk-tea-trial-equipment-${i}`) },
  { room: 'commercial-north-n1-interior', prefix: 'fruit-tea-trial-', worker: 'fruit-tea-trial-worker', services: ['fruit-tea-trial-order', 'fruit-tea-trial-pickup'], equipment: [1, 2, 3, 4, 5].map(i => `fruit-tea-trial-equipment-${i}`) },
] as const
const options = (actorId = 'protagonist') => ({ screenMetrics: sceneDesignReferenceMetrics, actorId, actorFootprint: { width: (actorId === 'protagonist' ? 11 : 16) / 19.2, height: (actorId === 'protagonist' ? 11 : 16) / 10.8 } })

describe('current drink-shop counter and worktop contracts', () => {
  for (const shop of shops) {
    it(`${shop.room}: rendered counter bodies stay in the room and have distinct interactive anchors`, () => {
      const room = scene.rooms.find(candidate => candidate.id === shop.room)!
      const bodies = scene.continuousStructures.filter(body => body.id.startsWith(shop.prefix))
      expect(bodies.length).toBeGreaterThanOrEqual(2)
      const anchors = scene.objects.filter(object => bodies.some(body => body.id === object.interactionStructureId))
      expect(anchors.length).toBeGreaterThanOrEqual(bodies.length)
      for (const body of bodies) {
        expect(body.x).toBeGreaterThanOrEqual(room.bounds.x)
        expect(body.y).toBeGreaterThanOrEqual(room.bounds.y)
        expect(body.x + body.width).toBeLessThanOrEqual(room.bounds.x + room.bounds.width)
        expect(body.y + body.height).toBeLessThanOrEqual(room.bounds.y + room.bounds.height)
        expect(anchors.some(anchor => anchor.interactionStructureId === body.id && anchor.interactive)).toBe(true)
        expect(anchors.filter(anchor => anchor.interactionStructureId === body.id).every(anchor =>
          anchor.position.x >= body.x && anchor.position.x <= body.x + body.width
          && anchor.position.y >= body.y && anchor.position.y <= body.y + body.height)).toBe(true)
      }
    })

    it(`${shop.room}: customer services remain reachable from the public door`, () => {
      const front = scene.passages.find(passage => passage.toRoomId === shop.room && passage.routeThrough)!
      expect(front.access).toBe('open')
      for (const id of shop.services) {
        const entity = scene.objects.find(object => object.id === id)!
        expect(entity).toBeDefined()
        expect(entity.interactive).toBe(true)
        const route = findMainlinePathToEntity(scene, id, front.crossingTargets[0]!, {}, options())
        expect(route.path, id).not.toBeNull()
        expect(isWalkableMainlinePoint(route.target, scene, {}, options())).toBe(true)
      }
    })

    it(`${shop.room}: only the staff actor reaches the locked rear door and consolidated worktop`, () => {
      const rear = scene.passages.find(passage => passage.id === `${shop.room}-rear-door`)!
      const workerStart = resolveMainlineNpcPosition(scene, shop.worker)
      expect(rear.access).toBe('locked')
      expect(findMainlinePath(workerStart, rear.thresholds[0]!, scene, {}, options(shop.worker))).not.toBeNull()
      expect(findMainlinePath(workerStart, rear.thresholds[0]!, scene, {}, options())).toBeNull()
      for (const id of shop.equipment) {
        const alias = scene.objects.find(object => object.id === id)!
        expect(alias).toMatchObject({ interactive: true, counterSurfaceId: expect.any(String), interactionStructureId: expect.any(String), interactionAliasId: expect.any(String) })
        const route = findMainlinePathToEntity(scene, id, workerStart, {}, options(shop.worker))
        expect(route.path, id).not.toBeNull()
      }
    })

    it(`${shop.room}: old counter-side positions recover in the same room and can return to its entrance`, () => {
      const room = scene.rooms.find(candidate => candidate.id === shop.room)!
      const old = { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 }
      const recovered = resolveMainlineSafeSpawnPosition(scene, old, {}, options())!
      expect(recovered).toBeDefined()
      expect(recovered.x).toBeGreaterThan(room.bounds.x)
      expect(recovered.x).toBeLessThan(room.bounds.x + room.bounds.width)
      expect(recovered.y).toBeGreaterThan(room.bounds.y)
      expect(recovered.y).toBeLessThan(room.bounds.y + room.bounds.height)
      expect(isWalkableMainlinePoint(recovered, scene, {}, options())).toBe(true)
      const front = scene.passages.find(passage => passage.toRoomId === shop.room && passage.routeThrough)!
      expect(findMainlinePath(recovered, front.crossingTargets[0]!, scene, {}, options())).not.toBeNull()
      expect(resolveMainlineSafeSpawnPosition(scene, recovered, {}, options())).toEqual(recovered)
    })
  }

  it('preserves Cafe story seats, the open restroom, and the existing coffee-order identity', () => {
    expect(scene.objects.find(object => object.id === commercialCafeLaoZhouConversationSeatId)?.seat?.tableId).toBe(commercialCafeStoryTableId)
    expect(scene.objects.find(object => object.id === 'commercial-cafe-counter')?.interactionBehavior).toBe('cafe-order')
    expect(scene.objects.filter(object => object.roomId === 'commercial-north-cafe-interior' && object.seat)).toHaveLength(12)
    expect(scene.passages.find(passage => passage.id === 'cafe-trial-customer-toilet-door')?.access).toBe('open')
    expect(scene.passages.find(passage => passage.id === 'commercial-north-cafe-interior-rear-door')?.access).toBe('locked')
  })
})
