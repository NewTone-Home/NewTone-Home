import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { canTravelAlongMainlineSegment, findMainlinePath, findMainlinePathToEntity, resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { currentCafeOptions, cafePoint } from './helpers/currentCafe'

const scene = mainlineScenes['commercial-street']
const actorOptions = (actorId: string) => ({ ...currentCafeOptions, actorId, actorFootprint: { width: 16 / 19.2, height: 16 / 10.8 } })

describe('visible counter terminals and Cafe employee opening', () => {
  for (const [roomId, prefix, worker, serviceIds] of [
    ['commercial-south-s5-interior', 'milk-tea-trial', 'milk-tea-trial-worker', ['commercial-s5-milk-tea-order-service-label', 'commercial-s5-milk-tea-pickup-service-label']],
    ['commercial-north-n1-interior', 'fruit-tea-trial', 'fruit-tea-trial-worker', ['fruit-tea-trial-order', 'fruit-tea-trial-pickup']],
  ] as const) {
    it(`${prefix}: the closed L counter separates customers from staff while its service anchors remain reachable`, () => {
      const room = scene.rooms.find(candidate => candidate.id === roomId)!
      const bodies = scene.continuousStructures.filter(body => body.id.startsWith(prefix))
      const counterBodies = bodies.filter(body => body.counterSurface?.role !== 'worktop')
      expect(counterBodies).toHaveLength(2)
      const front = scene.passages.find(passage => passage.toRoomId === roomId && passage.routeThrough)!
      for (const id of serviceIds) expect(findMainlinePathToEntity(scene, id, front.crossingTargets[0]!, {}, currentCafeOptions).path, id).not.toBeNull()
      const workerStart = resolveMainlineNpcPosition(scene, worker)
      const publicSide = { x: room.bounds.x + room.bounds.width / 2, y: front.crossingTargets[0]!.y }
      expect(findMainlinePath(publicSide, workerStart, scene, {}, actorOptions(worker))).toBeNull()
      const rear = scene.passages.find(passage => passage.id === `${roomId}-rear-door`)!
      expect(rear.access).toBe('locked')
      expect(findMainlinePath(workerStart, rear.thresholds[0]!, scene, {}, actorOptions(worker))).not.toBeNull()
      for (const body of counterBodies) {
        expect(body.x).toBeGreaterThanOrEqual(room.bounds.x)
        expect(body.y).toBeGreaterThanOrEqual(room.bounds.y)
        expect(body.x + body.width).toBeLessThanOrEqual(room.bounds.x + room.bounds.width)
        expect(body.y + body.height).toBeLessThanOrEqual(room.bounds.y + room.bounds.height)
      }
    })
  }

  it('keeps Cafe counters on both walls with one actual 32px staff gap', () => {
    const room = scene.rooms.find(candidate => candidate.id === 'commercial-north-cafe-interior')!
    const upper = scene.continuousStructures.find(body => body.id === 'cafe-trial-counter-upper-body')!
    const long = scene.continuousStructures.find(body => body.id === 'cafe-trial-counter-long-body')!
    const front = scene.continuousStructures.find(body => body.id === 'cafe-trial-counter-front-body')!
    expect(upper).toBeDefined(); expect(long).toBeDefined(); expect(front).toBeDefined()
    expect(upper.counterSurface?.groupId).not.toBe(long.counterSurface?.groupId)
    expect((long.y - upper.y - upper.height) * 10.8).toBeCloseTo(32, 4)
    expect(front.x).toBeGreaterThan(room.bounds.x)
    expect(front.x + front.width).toBeLessThan(room.bounds.x + room.bounds.width)
    const staff = actorOptions('cafe-coffee-owner'), start = cafePoint(164, 56), finish = cafePoint(228, 56)
    expect(canTravelAlongMainlineSegment(start, finish, scene, {}, staff)).toBe(true)
    expect(findMainlinePath(start, finish, scene, {}, staff)).not.toBeNull()
    expect(canTravelAlongMainlineSegment(start, finish, scene, {}, currentCafeOptions)).toBe(false)
    const frontDoor = scene.passages.find(passage => passage.id === 'street-cafe-entry')!
    expect(frontDoor.access).toBe('open')
    expect(frontDoor.thresholds.length).toBeGreaterThan(0)
    expect(frontDoor.toRoomId).toBe(room.id)
  })
})
