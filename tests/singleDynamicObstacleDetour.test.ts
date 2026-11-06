import { describe, expect, it, vi } from 'vitest'
import { findSingleDynamicObstacleDetour, createNavigationRuntime } from '../src/center/runtime/navigationCore'
import { findMainlinePath, isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import * as scenePathfinding from '../src/center/runtime/scenePathfinding'

const start = { x: 0, y: 0 }
const target = { x: 10, y: 0 }
const footprint = { width: 1, height: 1 }
const blocker = { x: 4, y: -1, width: 2, height: 2 }
const avoids = (boxes: typeof blocker) => (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const samples = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / .18))
  for (let index = 1; index <= samples; index += 1) {
    const progress = index / samples
    const x = from.x + (to.x - from.x) * progress
    const y = from.y + (to.y - from.y) * progress
    const actor = { x: x - .5, y: y - .5, width: 1, height: 1 }
    if (actor.x < boxes.x + boxes.width && actor.x + actor.width > boxes.x
      && actor.y < boxes.y + boxes.height && actor.y + actor.height > boxes.y) return false
  }
  return true
}

describe('bounded single dynamic obstacle detour', () => {
  it('routes around a wall-mounted rectangle with actor clearance', () => {
    const clearOfBlocker = avoids(blocker)
    const route = findSingleDynamicObstacleDetour(start, target, [blocker], footprint, (from, to) => {
      // Simulate a permanent wall that blocks the upper side of the blocker.
      const samples = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / .18))
      for (let index = 1; index <= samples; index += 1) {
        const progress = index / samples
        const y = from.y + (to.y - from.y) * progress
        if (y < -.01) return false
      }
      return clearOfBlocker(from, to)
    })
    expect(route).not.toBeNull()
    expect(route!.length).toBeGreaterThan(2)
    expect(route!.some(point => point.y > 1.5)).toBe(true)
    for (const point of route!.slice(1, -1)) {
      expect(point.y).toBeGreaterThanOrEqual(1.5)
    }
  })

  it('falls through when both sides are blocked or more than one rectangle blocks direct travel', () => {
    const noSideOpen = findSingleDynamicObstacleDetour(start, target, [blocker], footprint, (from, to) => {
      const samples = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / .18))
      for (let index = 1; index <= samples; index += 1) {
        const progress = index / samples
        const y = from.y + (to.y - from.y) * progress
        if (Math.abs(y) > .01) return false
      }
      return Math.abs(from.y) <= .01 && Math.abs(to.y) <= .01 && avoids(blocker)(from, to)
    })
    expect(noSideOpen).toBeNull()

    const twoBlockers = findSingleDynamicObstacleDetour(start, target, [blocker, { x: 7, y: -.5, width: 1, height: 1 }], footprint, () => true)
    expect(twoBlockers).toBeNull()
  })

  it('does not scrape a blocker corner and rejects endpoints the live validator blocks', () => {
    const route = findSingleDynamicObstacleDetour(start, target, [blocker], footprint, avoids(blocker))
    expect(route).not.toBeNull()
    expect(route!.slice(1, -1).every(point => point.y >= 1.55 || point.y <= -1.55)).toBe(true)
    expect(findSingleDynamicObstacleDetour(start, target, [blocker], footprint, (from, to) => (
      (to.x !== target.x || to.y !== target.y) && avoids(blocker)(from, to)
    ))).toBeNull()
  })

  it('detours around the live street pedestrian and uses a fresh direct route after it moves', () => {
    const street = mainlineScenes['commercial-street']
    const from = { x: 34, y: 50 }
    const destination = { x: 27.9204, y: 33.61765 }
    const screenMetrics = { width: 1180, height: 757, viewportWidth: 1180 }
    const actorFootprint = { width: .9322, height: 1.4531 }
    const geometrySnapshot = createMainlineSceneGeometrySnapshot(street, from, {}, screenMetrics)
    const runtime = createNavigationRuntime()
    runtime.registerActor('commercial-street-pedestrian-west-north', { x: 30.990625, y: 38.1111 }, { width: 1.15, height: 2.0444 })
    const options = { actorId: 'protagonist', actorFootprint, screenMetrics, geometrySnapshot, navigationRuntime: runtime }

    const detour = findMainlinePath(from, destination, street, {}, options)
    expect(detour).not.toBeNull()
    expect(detour!.length).toBeGreaterThan(2)

    runtime.updateActor('commercial-street-pedestrian-west-north', { x: 60, y: 38.1111 })
    expect(findMainlinePath(from, destination, street, {}, options)).toEqual([from, destination])
  }, 30_000)

  it('returns immediately when a live NPC occupies the requested destination', () => {
    const street = mainlineScenes['commercial-street']
    const from = { x: 34, y: 50 }
    const occupiedTarget = { x: 50, y: 50 }
    const runtime = createNavigationRuntime()
    runtime.registerActor('target-occupant', occupiedTarget, { width: 1.2, height: 1.2 })
    const options = { actorId: 'protagonist', actorFootprint: { width: 1.2, height: 1.2 }, navigationRuntime: runtime }
    expect(isWalkableMainlinePoint(occupiedTarget, street, {}, options)).toBe(false)
    expect(isWalkableMainlinePoint(occupiedTarget, street, {}, { ...options, navigationRuntime: undefined })).toBe(true)
    const createMesh = vi.spyOn(scenePathfinding, 'createPolygonNavigationMesh')

    try {
      expect(findMainlinePath(from, occupiedTarget, street, {}, options)).toBeNull()
      expect(createMesh).not.toHaveBeenCalled()
    } finally {
      createMesh.mockRestore()
    }
  })
})
