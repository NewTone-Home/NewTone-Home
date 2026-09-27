import { describe, expect, it } from 'vitest'
import {
  findMainlinePath,
  isMainlineNavigationBarrierClear,
  mainlineEntityInteractionCandidates,
  mainlineInteractionTarget,
  mainlineNavigationBarriers,
} from '../src/center/runtime/mainlineNavigation'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineProtagonistDotFootprint } from '../src/center/runtime/sceneLayout'

const protagonistFootprint = mainlineProtagonistDotFootprint(mainlineScenes['commercial-cafe'].initialPlayerPosition)
const protagonistOptions = {
  actorId: 'protagonist',
  actorFootprint: { width: protagonistFootprint.width, height: protagonistFootprint.height },
} as const

function sourcesAround(position: { x: number; y: number }) {
  const contactOffset = Math.max(protagonistFootprint.width, protagonistFootprint.height) + 1
  return [
    { x: position.x - contactOffset, y: position.y },
    { x: position.x + contactOffset, y: position.y },
    { x: position.x, y: position.y - contactOffset },
    { x: position.x, y: position.y + contactOffset },
  ]
}

describe('ordinary floor interaction and access-boundary contracts', () => {
  it('removes authored approaches from ordinary floor-object candidates in every direction', () => {
    const targets = [
      [mainlineScenes['commercial-cafe'], 'commercial-cafe-plant-upper'],
      [mainlineScenes['commercial-cafe'], 'commercial-cafe-plant-lower'],
      [mainlineScenes['zhongshuyuan-office'], 'zhongshuyuan-office-plant'],
      [mainlineScenes['zhongshuyuan-office'], 'zhongshuyuan-office-rack'],
    ] as const

    for (const [scene, entityId] of targets) {
      const entity = scene.objects.find((candidate) => candidate.id === entityId)!
      expect(entity.approach).toBeDefined()
      for (const from of sourcesAround(entity.position)) {
        const candidates = mainlineEntityInteractionCandidates(scene, entity.id, from, {}, protagonistOptions.actorFootprint, protagonistOptions)
        expect(candidates).not.toContainEqual(entity.approach)
        expect(mainlineInteractionTarget(scene, entity.id, from, {}, undefined, protagonistOptions)).not.toEqual(entity.approach)
      }
    }
  })

  it('keeps old-tree and altar interactions on dynamic footprint edges', () => {
    const yard = mainlineScenes['jijia-ancestral-home']
    const shrine = mainlineScenes['jijia-ancestral-interior']
    for (const [scene, entityId] of [
      [yard, 'jijia-old-tree'],
      [shrine, 'jijia-offering-table-north'],
      [shrine, 'jijia-incense-burner'],
    ] as const) {
      const entity = scene.objects.find((candidate) => candidate.id === entityId)!
      const snapshot = createMainlineSceneGeometrySnapshot(scene, scene.initialPlayerPosition)
      const collision = snapshot.objects.get(entity.id)!.collision!
      const target = mainlineInteractionTarget(scene, entity.id, scene.initialPlayerPosition, {}, undefined, protagonistOptions)
      expect(target.x < collision.x || target.x > collision.x + collision.width || target.y < collision.y || target.y > collision.y + collision.height).toBe(true)
    }
  })

  it('uses the same access boundary for planner, route traversal, and live-movement legality', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const boundary = mainlineNavigationBarriers(cafe, {}, protagonistOptions).find((candidate) => candidate.kind === 'access-boundary')!
    const midpoint = (boundary.start.y + boundary.end.y) / 2
    const publicPoint = { x: boundary.start.x + 1, y: midpoint }
    const staffPoint = { x: boundary.start.x - 1, y: midpoint }

    expect(isMainlineNavigationBarrierClear(publicPoint, staffPoint, cafe, {}, protagonistOptions)).toBe(false)
    expect(findMainlinePath(publicPoint, staffPoint, cafe, {}, protagonistOptions)).toBeNull()
    expect(isMainlineNavigationBarrierClear(publicPoint, staffPoint, cafe, {}, { actorId: 'server' })).toBe(true)
    expect(findMainlinePath(publicPoint, staffPoint, cafe, {}, { actorId: 'server' })).not.toBeNull()
  })
})
