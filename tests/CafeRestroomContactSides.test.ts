import { describe, expect, it } from 'vitest'
import { cafeRestroomFaucetId, cafeRestroomToiletId } from '../src/center/runtime/cafeRestroom'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { isWalkableMainlinePoint, resolveMainlineEntityInteraction } from '../src/center/runtime/mainlineNavigation'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'

const scene = mainlineScenes['commercial-street']
const options = {
  screenMetrics: sceneDesignReferenceMetrics,
  actorId: 'protagonist',
  actorFootprint: { width: 11 / 19.2, height: 11 / 10.8 },
}

describe('restroom fixture front contacts', () => {
  it.each([
    { id: cafeRestroomToiletId, side: 'south', offsetX: 1.5, offsetY: 1.8 },
    { id: cafeRestroomFaucetId, side: 'west', offsetX: 1, offsetY: 3 },
  ] as const)('routes all four starting sides to the $side-facing front of $id', ({ id, side, offsetX, offsetY }) => {
    const fixture = scene.objects.find((candidate) => candidate.id === id)!
    const starts = [
      { x: fixture.position.x - offsetX, y: fixture.position.y },
      { x: fixture.position.x + offsetX, y: fixture.position.y },
      { x: fixture.position.x, y: fixture.position.y - offsetY },
      { x: fixture.position.x, y: fixture.position.y + offsetY },
    ]

    const reachableStarts = starts.filter((from) => isWalkableMainlinePoint(from, scene, {}, options))
    expect(reachableStarts.length).toBeGreaterThanOrEqual(3)
    const results = reachableStarts.map((from) => ({
      from,
      result: resolveMainlineEntityInteraction(scene, id, from, {}, options),
    }))
    for (const { result } of results) {
      if (!result.path) continue
      if (side === 'south') {
        expect(result.target.y).toBeGreaterThan(fixture.position.y)
        expect(Math.abs(result.target.x - fixture.position.x)).toBeLessThan(.15)
      } else {
        expect(result.target.x).toBeLessThan(fixture.position.x)
        expect(Math.abs(result.target.y - fixture.position.y)).toBeLessThan(.15)
      }
    }
    expect(results.every(({ result }) => result.path !== null)).toBe(true)
  })
})
