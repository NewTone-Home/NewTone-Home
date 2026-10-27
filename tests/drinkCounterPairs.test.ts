import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { findMainlinePathToEntity, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const scene = mainlineScenes['commercial-street']
const shops = [
  ['commercial-north-cafe-interior', 'cafe-trial-counter', 3, ['commercial-cafe-counter', 'cafe-trial-order', 'cafe-trial-pickup']],
  ['commercial-south-s5-interior', 'milk-tea-trial', 3, ['commercial-s5-milk-tea-order-service-label']],
  ['commercial-north-n1-interior', 'fruit-tea-trial', 3, ['fruit-tea-trial-order']],
] as const

describe('continuous counter bodies and service anchors', () => {
  for (const [roomId, prefix, expectedBodies, serviceIds] of shops) {
    it(`${roomId}: has non-overlapping interactive surfaces with reachable service anchors`, () => {
      const room = scene.rooms.find(candidate => candidate.id === roomId)!
      const bodies = scene.continuousStructures.filter(body => body.id.startsWith(prefix))
      expect(bodies).toHaveLength(expectedBodies)
      for (const body of bodies) {
        expect(body.width * 19.2).toBeGreaterThanOrEqual(16)
        expect(body.height * 10.8).toBeGreaterThanOrEqual(16)
        expect(body.x).toBeGreaterThanOrEqual(room.bounds.x)
        expect(body.y).toBeGreaterThanOrEqual(room.bounds.y)
        expect(body.x + body.width).toBeLessThanOrEqual(room.bounds.x + room.bounds.width)
        expect(body.y + body.height).toBeLessThanOrEqual(room.bounds.y + room.bounds.height)
        const anchors = scene.objects.filter(object => object.interactionStructureId === body.id)
        expect(anchors.length).toBeGreaterThan(0)
        expect(anchors.every(anchor => anchor.interactive)).toBe(true)
        expect(anchors.every(anchor => anchor.counterSurfaceId === body.counterSurface?.groupId)).toBe(true)
      }
      const front = scene.passages.find(passage => passage.toRoomId === roomId && passage.routeThrough)!
      for (const id of serviceIds) {
        const target = scene.objects.find(object => object.id === id)!
        expect(target).toBeDefined()
        const route = findMainlinePathToEntity(scene, id, front.crossingTargets[0]!, {}, {
          screenMetrics: sceneDesignReferenceMetrics,
          actorId: 'protagonist',
          actorFootprint: { width: 11 / 19.2, height: 11 / 10.8 },
        })
        expect(route.path, id).not.toBeNull()
        expect(isWalkableMainlinePoint(route.target, scene, {}, {
          screenMetrics: sceneDesignReferenceMetrics,
          actorId: 'protagonist',
          actorFootprint: { width: 11 / 19.2, height: 11 / 10.8 },
        })).toBe(true)
      }
    })
  }
})
