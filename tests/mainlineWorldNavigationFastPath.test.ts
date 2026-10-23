import { beforeEach, describe, expect, it, vi } from 'vitest'

const meshBuilds = vi.hoisted(() => ({ full: 0, deferred: 0 }))

vi.mock('../src/center/runtime/scenePathfinding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/center/runtime/scenePathfinding')>()
  return {
    ...actual,
    createPolygonNavigationMesh: (input: { deferTopology?: boolean }, ...rest: unknown[]) => {
      if (input.deferTopology) meshBuilds.deferred += 1
      else meshBuilds.full += 1
      return actual.createPolygonNavigationMesh(input as never, ...rest as never[])
    },
  }
})

import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { resolveMainlineWorldNavigation } from '../src/center/runtime/mainlineNavigation'

const protagonistOptions = {
  actorId: 'protagonist',
  screenMetrics: sceneDesignReferenceMetrics,
  actorFootprint: { width: 11 / 19.2, height: 11 / 10.8 },
}

describe('world navigation permission-intent fast path', () => {
  beforeEach(() => {
    meshBuilds.full = 0
    meshBuilds.deferred = 0
  })

  it('does not build a physical-only mesh for a successful public route, and reuses the prepared mesh', () => {
    const scene = { ...mainlineScenes['commercial-street'] }
    const from = { x: 34, y: 50 }
    const target = { x: (1100 / 1180) * 100, y: (378 / 757) * 100 }

    const first = resolveMainlineWorldNavigation(scene, from, target, {}, protagonistOptions)!
    expect(first.reachedRequestedTarget).toBe(true)
    expect(first.resolvedNavigableTarget).toEqual(target)
    expect(first.deniedAccessRegion).toBeUndefined()
    expect(meshBuilds.full).toBe(1) // The prepared, permission-aware mesh only.

    const second = resolveMainlineWorldNavigation(scene, from, target, {}, protagonistOptions)!
    expect(second.reachedRequestedTarget).toBe(true)
    expect(meshBuilds.full).toBe(1)
  })

  it('still builds/reuses physical intent for an employee-area target and reports the denied region', () => {
    const scene = { ...mainlineScenes['commercial-street'] }
    const staff = scene.accessRegions.find(region => region.id === 'commercial-cafe-staff-area')!
    const front = scene.passages.find(passage => passage.id === 'street-cafe-entry')!
    const from = front.crossingTargets[0]
    const target = { x: staff.x + staff.width / 2, y: staff.y + staff.height / 2 }

    const first = resolveMainlineWorldNavigation(scene, from, target, {}, protagonistOptions)!
    expect(first.reachedRequestedTarget).toBe(false)
    expect(first.deniedAccessRegion?.id).toBe(staff.id)
    expect(first.path.at(-1)).toEqual(first.resolvedNavigableTarget)
    expect(meshBuilds.full).toBe(2) // Prepared mesh plus the physical intent mesh.

    const second = resolveMainlineWorldNavigation(scene, from, target, {}, protagonistOptions)!
    expect(second.deniedAccessRegion?.id).toBe(staff.id)
    expect(meshBuilds.full).toBe(2) // Same exact static inputs hit the bounded cache.
  })
})
