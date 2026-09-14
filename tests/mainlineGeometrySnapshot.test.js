import { describe, expect, it } from 'vitest'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import {
  mainlineInteractionTarget,
  mainlinePassageCrossesToSide,
  mainlinePassageCollisionForNavigation,
  mainlinePassageDoorwayForNavigation,
  mainlinePassageSide,
  isWalkableMainlinePoint,
} from '../src/center/runtime/mainlineNavigation'

const viewports = [
  { name: 'phone portrait', width: 390, height: 844 },
  { name: 'phone landscape', width: 844, height: 390 },
  { name: 'iPad portrait', width: 834, height: 1194 },
  { name: 'iPad landscape', width: 1194, height: 834 },
]

const playableScenes = Object.values(mainlineScenes)

function assertFinitePoint(point, label) {
  expect(Number.isFinite(point.x), `${label}.x`).toBe(true)
  expect(Number.isFinite(point.y), `${label}.y`).toBe(true)
}

function assertValidBox(box, label) {
  expect(box, label).toBeTruthy()
  expect(Number.isFinite(box.x), `${label}.x`).toBe(true)
  expect(Number.isFinite(box.y), `${label}.y`).toBe(true)
  expect(box.width, `${label}.width`).toBeGreaterThan(0)
  expect(box.height, `${label}.height`).toBeGreaterThan(0)
}

describe('mainline screen geometry snapshot', () => {
  it.each(viewports)('keeps the office desk contact point outside the desk on $name', (screenMetrics) => {
    const scene = mainlineScenes['zhongshuyuan-office']
    const desk = scene.objects.find((entity) => entity.id === 'zhongshuyuan-office-desk')
    expect(desk?.approach).toBeTruthy()
    const snapshot = createMainlineSceneGeometrySnapshot(scene, scene.initialPlayerPosition, {}, screenMetrics)
    const target = mainlineInteractionTarget(scene, desk.id, scene.initialPlayerPosition, {}, undefined, {
      screenMetrics,
      geometrySnapshot: snapshot,
    })

    expect(target.y).toBeGreaterThan(desk.position.y + 4)
    expect(isWalkableMainlinePoint(target, scene, {}, {
      screenMetrics,
      geometrySnapshot: snapshot,
    })).toBe(true)
  })

  it('recognizes a crossing that begins inside the doorway', () => {
    const scene = Object.values(mainlineScenes).find((candidate) => candidate.passages.some((passage) => passage.targetSceneId))
    const passage = scene?.passages.find((candidate) => candidate.targetSceneId)
    expect(passage).toBeTruthy()
    const doorway = passage.doorway
    const center = { x: doorway.x + doorway.width / 2, y: doorway.y + doorway.height / 2 }
    const target = passage.crossingTargets[0]
    const targetSide = mainlinePassageSide(passage, target)
    expect(mainlinePassageCrossesToSide(passage, center, target, targetSide)).toBe(true)
  })

  it.each(viewports)('keeps one geometry source for $name', (screenMetrics) => {
    playableScenes.forEach((scene) => {
      const snapshot = createMainlineSceneGeometrySnapshot(scene, scene.initialPlayerPosition, {}, screenMetrics)
      expect(snapshot.screenMetrics).toEqual(screenMetrics)
      expect(snapshot.units.length, `${scene.id}: projected units`).toBeGreaterThan(0)
      assertValidBox(snapshot.walkBounds, `${scene.id}: walkBounds`)

      scene.objects.forEach((entity) => {
        const geometry = snapshot.objects.get(entity.id)
        expect(geometry, `${scene.id}:${entity.id}: object geometry`).toBeTruthy()
        assertFinitePoint(geometry.position, `${scene.id}:${entity.id}: position`)
        if (geometry.interactionBounds) assertValidBox(geometry.interactionBounds, `${scene.id}:${entity.id}: interactionBounds`)
        if (geometry.visualBounds) assertValidBox(geometry.visualBounds, `${scene.id}:${entity.id}: visualBounds`)
        if (geometry.collision) assertValidBox(geometry.collision, `${scene.id}:${entity.id}: collision`)

        const target = mainlineInteractionTarget(scene, entity.id, scene.initialPlayerPosition, {}, undefined, {
          screenMetrics,
          geometrySnapshot: snapshot,
        })
        assertFinitePoint(target, `${scene.id}:${entity.id}: interaction target`)
      })

      scene.passages.forEach((passage) => {
        const passageGeometry = snapshot.passages.get(passage.id)
        expect(passageGeometry, `${scene.id}:${passage.id}: passage geometry`).toBeTruthy()
        assertValidBox(passageGeometry.collision, `${scene.id}:${passage.id}: collision`)
        assertValidBox(passageGeometry.doorway, `${scene.id}:${passage.id}: doorway`)
        expect(mainlinePassageCollisionForNavigation(scene, passage, { screenMetrics, geometrySnapshot: snapshot })).toEqual(passageGeometry.collision)
        expect(mainlinePassageDoorwayForNavigation(scene, passage, { screenMetrics, geometrySnapshot: snapshot })).toEqual(passageGeometry.doorway)
      })

      snapshot.wallFeatures.forEach((feature) => {
        assertValidBox(feature.bounds, `${scene.id}:${feature.entityId}: wall feature bounds`)
        assertFinitePoint(feature.position, `${scene.id}:${feature.entityId}: wall feature position`)
        const target = mainlineInteractionTarget(scene, feature.entityId, scene.initialPlayerPosition, {}, undefined, {
          screenMetrics,
          geometrySnapshot: snapshot,
        })
        assertFinitePoint(target, `${scene.id}:${feature.entityId}: wall interaction target`)
        if (feature.edge === 'top' || feature.edge === 'bottom') {
          expect(target.x).toBeGreaterThanOrEqual(feature.bounds.x - 0.001)
          expect(target.x).toBeLessThanOrEqual(feature.bounds.x + feature.bounds.width + 0.001)
        } else {
          expect(target.y).toBeGreaterThanOrEqual(feature.bounds.y - 0.001)
          expect(target.y).toBeLessThanOrEqual(feature.bounds.y + feature.bounds.height + 0.001)
        }
      })
    })
  })
})
