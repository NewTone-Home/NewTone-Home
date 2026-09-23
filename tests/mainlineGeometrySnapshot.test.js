import { describe, expect, it } from 'vitest'
import { mainlineSceneGeometryUnits, mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import {
  mainlineInteractionTarget,
  mainlinePassageCrossesToSide,
  mainlinePassageCollisionForNavigation,
  mainlinePassageDoorwayForNavigation,
  mainlinePassageSide,
  resolveMainlineSafeEntryPosition,
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

function renderedDoorLabel(cell) {
  return cell.doorLabelPart ?? cell.displayLabel ?? cell.label ?? cell.glyph ?? '门'
}

function doorCells(scene, entityId) {
  return mainlineSceneGeometryUnits(scene, scene.initialPlayerPosition)
    .flatMap((unit) => unit.visual.cells.map((cell) => ({ ...cell, entityId: cell.entityId ?? unit.entityId })))
    .filter((cell) => cell.kind === 'door' && cell.entityId === entityId)
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

  it('keeps the passage and office secret door as one cross-scene identity', () => {
    const passageScene = mainlineScenes['zhongshuyuan-passage']
    const officeScene = mainlineScenes['zhongshuyuan-office']
    const canonicalId = 'zhongshuyuan-office-secret-door'
    const forward = passageScene.passages.find((passage) => passage.targetSceneId === officeScene.id)
    const reverse = officeScene.passages.find((passage) => passage.targetSceneId === passageScene.id)

    expect(forward).toMatchObject({ id: canonicalId, entityId: canonicalId, targetSceneId: officeScene.id })
    expect(reverse).toMatchObject({ id: canonicalId, entityId: canonicalId, targetSceneId: passageScene.id })

    const officeEntry = resolveMainlineSafeEntryPosition(officeScene, passageScene.id, forward.entryPosition)
    const passageEntry = resolveMainlineSafeEntryPosition(passageScene, officeScene.id, reverse.entryPosition)

    expect(officeEntry).toBeTruthy()
    expect(passageEntry).toBeTruthy()
    expect(isWalkableMainlinePoint(officeEntry, officeScene)).toBe(true)
    expect(isWalkableMainlinePoint(passageEntry, passageScene)).toBe(true)
  })

  it('keeps normal door text on portal entities while split and storefront labels retain their own roles', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const cafeBackDoorOpening = cafe.structures
      .find((structure) => structure.id === 'commercial-cafe-room')
      ?.openings.find((opening) => opening.doorId === 'cafe-back-door')
    const cafeBackDoor = cafe.portals.find((portal) => portal.id === 'cafe-back-door')
    const cafeBackDoorCell = doorCells(cafe, 'cafe-back-door')[0]

    expect(cafeBackDoorOpening).toMatchObject({ doorId: 'cafe-back-door', labelLayout: 'center' })
    expect(cafeBackDoorOpening?.label).toBeUndefined()
    expect(cafeBackDoorOpening?.displayLabel).toBeUndefined()
    expect(cafeBackDoor?.entity).toMatchObject({ label: '后门', displayLabel: '门' })
    expect(renderedDoorLabel(cafeBackDoorCell)).toBe('门')

    const yard = mainlineScenes['jijia-ancestral-home']
    const yardGateOpening = yard.structures
      .find((structure) => structure.id === 'jijia-yard')
      ?.openings.find((opening) => opening.doorId === 'jijia-yard-gate')
    const yardGateParts = doorCells(yard, 'jijia-yard-gate')
      .map((cell) => cell.doorLabelPart)
      .filter(Boolean)

    expect(yardGateOpening).toMatchObject({ label: '院门', labelLayout: 'split' })
    expect(yardGateParts).toEqual(['院', '门'])

    const perimeter = mainlineScenes['yonghe-mining-perimeter']
    const eatery = mainlineScenes['yonghe-eatery']
    const storefront = perimeter.storefronts.find((candidate) => candidate.portalId === 'yonghe-street-entry')
    const insideDoor = eatery.portals.find((portal) => portal.id === 'yonghe-street-entry')
    const insideDoorOpening = eatery.structures
      .find((structure) => structure.id === 'yonghe-room')
      ?.openings.find((opening) => opening.doorId === 'yonghe-street-entry')
    const insideDoorCell = doorCells(eatery, 'yonghe-street-entry')[0]
    const outwardPassage = perimeter.passages.find((passage) => passage.id === 'yonghe-street-entry')
    const returnPassage = eatery.passages.find((passage) => passage.id === 'yonghe-street-entry')

    expect(storefront?.label).toBe('永和小馆')
    expect(insideDoor?.entity).toMatchObject({ label: '永和小馆', displayLabel: '门' })
    expect(insideDoorOpening?.label).toBeUndefined()
    expect(renderedDoorLabel(insideDoorCell)).toBe('门')
    expect(outwardPassage).toMatchObject({ entityId: 'yonghe-street-entry', targetSceneId: 'yonghe-eatery' })
    expect(returnPassage).toMatchObject({ entityId: 'yonghe-street-entry', targetSceneId: 'yonghe-mining-perimeter' })
  })

  it('keeps Yonghe outdoor chairs physical while limiting interaction to their tables', () => {
    const scene = mainlineScenes['yonghe-mining-perimeter']
    const tableIds = ['yonghe-outdoor-table-1', 'yonghe-outdoor-table-2']
    const chairIds = [
      'yonghe-outdoor-chair-1-top',
      'yonghe-outdoor-chair-1-bottom',
      'yonghe-outdoor-chair-2-top',
      'yonghe-outdoor-chair-2-bottom',
    ]

    tableIds.forEach((id) => {
      expect(scene.objects.find((entity) => entity.id === id)?.interactive).not.toBe(false)
    })
    chairIds.forEach((id) => {
      const chair = scene.objects.find((entity) => entity.id === id)
      expect(chair?.interactive).toBe(false)
      expect(chair?.collision).toBeTruthy()
      expect(chair?.shape).toEqual(chair?.collision)
    })
    ;['yonghe-outdoor-group-1', 'yonghe-outdoor-group-2'].forEach((groupId, index) => {
      const group = scene.furnitureGroups.find((candidate) => candidate.id === groupId)
      expect(group?.entityIds).toEqual([tableIds[index], ...chairIds.slice(index * 2, index * 2 + 2)])
    })
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
