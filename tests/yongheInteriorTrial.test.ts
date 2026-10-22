import { describe, it, expect } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { findMainlinePathToEntity, canActorReachPassageApproach, isWalkableMainlinePoint, canTravelAlongMainlineSegment, findMainlinePath } from '../src/center/runtime/mainlineNavigation'

for (const sceneId of ['yonghe-mining-perimeter', 'yonghe-eatery'] as const) {
  const scene = mainlineScenes[sceneId]
  const room = scene.rooms.find(entry => entry.id === 'mining-shop-2-interior')!
  const frontX = room.bounds.width * 19.2
  const point = (x: number, y: number) => ({ x: room.bounds.x + (frontX - y) / 19.2, y: room.bounds.y + x / 10.8 })
  const options = { screenMetrics: sceneDesignReferenceMetrics }

  describe(sceneId + ' rotated restaurant', () => {
    it('keeps the menu on the right wall and rotates the existing tables and kitchen with the room', () => {
      const menu = scene.objects.find(object => object.id === 'yonghe-menu')!
      expect(menu.position.x).toBeCloseTo(point(616, 0).x, 10)
      expect(menu.position.y).toBeCloseTo(point(616, 0).y, 10)
      expect(scene.objects.filter(object => object.roomId === room.id && object.kind === 'table')).toHaveLength(4)
      expect(scene.objects.filter(object => object.roomId === room.id && object.seat)).toHaveLength(8)
      const stove = scene.objects.find(object => object.id === 'yonghe-stove')!
      expect(stove.position.x).toBeCloseTo(point(84, 224).x, 10)
      expect(stove.position.y).toBeCloseTo(point(84, 224).y, 10)
      expect(scene.passages.find(passage => passage.id === 'yonghe-back-door')?.access).toBe('locked')
      const rear = scene.objects.find(object => object.id === 'yonghe-back-door')!
      expect(rear.position.x).toBeCloseTo(point(0, 252).x, 10)
      expect(rear.position.y).toBeCloseTo(point(0, 252).y, 10)
      const old = point(0, 168)
      const atOld = scene.geometry.filter(unit => unit.x <= old.x && unit.x + unit.width >= old.x && unit.y <= old.y && unit.y + unit.height >= old.y)
      expect(atOld.some(unit => unit.navigation.passageId === 'yonghe-back-door')).toBe(false)
      expect(atOld.some(unit => unit.navigation.blocked)).toBe(true)
      expect(isWalkableMainlinePoint(old, scene, {}, options)).toBe(false)
    })

    it('does not expose the removed central-lane survey placeholder or its test description', () => {
      expect(scene.objects.some(object => object.id === 'yonghe-survey-central-lane')).toBe(false)
      expect(scene.explorationText?.['yonghe-survey-central-lane']).toBeUndefined()
    })

    it('reaches each seat and menu from the customer aisle while chair-table gaps stay blocked', () => {
      const from = point(364, 154)
      for (const entity of scene.objects.filter(object => object.seat && object.id.startsWith('yonghe-'))) {
        expect(findMainlinePathToEntity(scene, entity.id, from, {}, options).path, entity.id).not.toBeNull()
        const table = scene.objects.find(object => object.id === entity.seat!.tableId)!
        const middle = { x: (entity.position.x + table.position.x) / 2, y: entity.position.y }
        expect(Math.abs(entity.position.x - table.position.x) * 19.2 - 16).toBeCloseTo(6, 4)
        for (const width of [11, 16]) {
          expect(canTravelAlongMainlineSegment(
            { x: middle.x - 2 / 19.2, y: middle.y },
            { x: middle.x + 2 / 19.2, y: middle.y },
            scene, {}, { ...options, actorFootprint: { width: width / 19.2, height: width / 10.8 } },
          )).toBe(false)
        }
      }
      expect(findMainlinePathToEntity(scene, 'yonghe-menu', from, {}, options).path).not.toBeNull()
      expect(canActorReachPassageApproach(scene, scene.passages.find(passage => passage.id === 'yonghe-street-entry')!, from, {}, options)?.path).not.toBeNull()
    })

    it('keeps both outdoor table groups in the street and clears the front-door approach', () => {
      const lane = scene.rooms.find(entry => entry.id === 'mining-street-public-lane')!
      for (const group of scene.furnitureGroups.filter(entry => entry.id.startsWith('yonghe-outdoor-'))) {
        for (const id of group.entityIds) {
          const object = scene.objects.find(entry => entry.id === id)!
          expect(object.position.y - 8 / 10.8).toBeGreaterThan(room.bounds.y + room.bounds.height)
          expect(object.position.y + 8 / 10.8).toBeLessThan(lane.bounds.y + lane.bounds.height)
          expect(object.position.x).toBeGreaterThan(room.bounds.x)
          expect(object.position.x).toBeLessThan(room.bounds.x + room.bounds.width)
        }
      }
      const entrance = scene.passages.find(passage => passage.id === 'yonghe-street-entry')!
      expect(isWalkableMainlinePoint(entrance.thresholds[0], scene, {}, options)).toBe(true)
    })

    it('keeps the work zone staff-only, counter continuous, and rear door unreachable through the wall', () => {
      const staff = { ...options, actorId: 'yonghe-trial-worker', actorFootprint: { width: 16 / 19.2, height: 16 / 10.8 } }
      const workerStart = point(168, 154)
      expect(isWalkableMainlinePoint(workerStart, scene, {}, options)).toBe(false)
      expect(isWalkableMainlinePoint(workerStart, scene, {}, staff)).toBe(true)
      expect(findMainlinePath(workerStart, point(280, 154), scene, {}, staff)).not.toBeNull()
      const rear = scene.passages.find(passage => passage.id === 'yonghe-back-door')!
      expect(findMainlinePath(workerStart, rear.thresholds[0], scene, {}, staff)).not.toBeNull()
      for (const width of [11, 16]) {
        expect(canTravelAlongMainlineSegment(point(196, 14), point(252, 14), scene, {}, {
          ...staff, actorFootprint: { width: width / 19.2, height: width / 10.8 },
        })).toBe(false)
      }
    })
  })
}
