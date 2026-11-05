import { describe, expect, it } from 'vitest'
import { mainlineCanonicalSceneGeometryUnits, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { canTravelAlongMainlineSegment, findMainlinePath, findMainlinePathToEntity, resolveMainlineNpcPosition } from '../src/center/runtime/mainlineNavigation'
import { currentCafeOptions, cafePoint } from './helpers/currentCafe'

const scene = mainlineScenes['commercial-street']
const actorOptions = (actorId: string) => ({ ...currentCafeOptions, actorId, actorFootprint: { width: 16 / 19.2, height: 16 / 10.8 } })

describe('visible counter terminals and Cafe employee opening', () => {
  it('centers each takeaway counter return on its real wall glyph and preserves the work gaps', () => {
    const expectations = [
      { roomId: 'commercial-south-s5-interior', prefix: 'milk-tea-trial', wallX: 336, wallY: 168, front: 8, horizontalY: 157, worktopY: 207, worktopHeight: 373, rear: 636 },
      { roomId: 'commercial-north-n1-interior', prefix: 'fruit-tea-trial', wallX: 0, wallY: 476, front: 636, horizontalY: 465, worktopY: 64, worktopHeight: 373, rear: 8 },
    ] as const
    const units = mainlineCanonicalSceneGeometryUnits(scene, currentCafeOptions.screenMetrics)
    for (const expected of expectations) {
      const room = scene.rooms.find(candidate => candidate.id === expected.roomId)!
      const horizontal = scene.continuousStructures.find(body => body.id === `${expected.prefix}-front-return-body`)!
      const outline = horizontal.counterSurface!.outlineBounds!
      const frontGap = expected.front === 8 ? expected.horizontalY - expected.front : expected.front - (expected.horizontalY + 22)
      const wallWorldX = room.bounds.x * 19.2 + expected.wallX
      const wallWorldY = room.bounds.y * 10.8 + expected.wallY
      const wallGlyphs = units.flatMap(unit => unit.visual.cells.filter(cell => cell.kind === 'wall'
        && Math.abs(cell.x * 19.2 - wallWorldX) < .01
        && Math.abs(cell.y * 10.8 - wallWorldY) < .01))
      expect(wallGlyphs.length, `${expected.prefix} adjacent wall glyph`).toBeGreaterThan(0)
      const horizontalCenterY = (horizontal.y - room.bounds.y + horizontal.height / 2) * 10.8
      const outlineCenterY = (outline.y - room.bounds.y + outline.height / 2) * 10.8
      expect(horizontalCenterY).toBeCloseTo(expected.wallY, 4)
      expect(outlineCenterY).toBeCloseTo(expected.wallY, 4)
      expect(frontGap).toBe(149)
      const worktop = scene.continuousStructures.find(body => body.id === `${expected.prefix}-worktop-body`)!
      const worktopStart = (worktop.y - room.bounds.y) * 10.8
      const worktopEnd = worktopStart + worktop.height * 10.8
      const counterStart = expected.horizontalY
      const counterEnd = counterStart + 22
      const counterToWorktop = expected.front === 8 ? worktopStart - counterEnd : counterStart - worktopEnd
      const worktopToRear = expected.front === 8 ? expected.rear - worktopEnd : worktopStart - expected.rear
      expect(counterToWorktop).toBeCloseTo(28, 4)
      expect(worktopToRear).toBeCloseTo(56, 4)
      const long = scene.continuousStructures.find(body => body.id === `${expected.prefix}-long-counter-body`)!
      expect((long.y - room.bounds.y) * 10.8).toBeCloseTo(expected.front === 8 ? expected.horizontalY : 8, 4)
      expect((long.y + long.height - room.bounds.y) * 10.8).toBeCloseTo(expected.front === 8 ? expected.rear : counterEnd, 4)
    }
  })

  for (const [roomId, prefix, worker, serviceIds] of [
    ['commercial-south-s5-interior', 'milk-tea-trial', 'milk-tea-trial-worker', ['commercial-s5-milk-tea-order-service-label']],
    ['commercial-north-n1-interior', 'fruit-tea-trial', 'fruit-tea-trial-worker', ['fruit-tea-trial-order']],
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
