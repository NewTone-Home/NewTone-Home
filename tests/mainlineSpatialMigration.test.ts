import { describe, expect, it } from 'vitest'
import { sceneDesignReferenceMetrics } from '../src/center/runtime/sceneBoundaryGrid'
import { createMainlineSceneGeometrySnapshot } from '../src/center/runtime/mainlineSceneGeometrySnapshot'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { mainlineEntityTextFootprint } from '../src/center/runtime/sceneLayout'

describe('mainline ordinary-object spatial migration', () => {
  it('uses rendered text footprints for migrated ordinary furniture and altar objects', () => {
    const yonghe = mainlineScenes['yonghe-mining-perimeter']
    const eatery = mainlineScenes['yonghe-eatery']
    const interiorTable = yonghe.objects.find((entity) => entity.id === 'yonghe-outdoor-table-1')!
    const interiorChair = yonghe.objects.find((entity) => entity.id === 'yonghe-outdoor-chair-1-top')!
    const shrine = mainlineScenes['jijia-ancestral-interior']
    const offeringTable = shrine.objects.find((entity) => entity.label === '供桌')!
    const incense = shrine.objects.find((entity) => entity.label === '香炉')!
    const yard = mainlineScenes['jijia-ancestral-home']
    const oldTree = yard.objects.find((entity) => entity.id === 'jijia-old-tree')!
    const office = mainlineScenes['zhongshuyuan-office']
    const officeDesk = office.objects.find((entity) => entity.id === 'zhongshuyuan-office-desk')!
    const officeChair = office.objects.find((entity) => entity.id === 'zhongshuyuan-office-chair')!
    const officePlant = office.objects.find((entity) => entity.id === 'zhongshuyuan-office-plant')!
    const yongheCounter = eatery.objects.find((entity) => entity.id === 'yonghe-counter')!
    const yongheStove = eatery.objects.find((entity) => entity.id === 'yonghe-stove')!
    const cafe = mainlineScenes['commercial-cafe']
    const cafeFourSeatTable = cafe.objects.find((entity) => entity.id === 'cafe-trial-table-group-1-table')!
    const cafeFourSeatChair = cafe.objects.find((entity) => entity.id === 'cafe-trial-table-group-1-chair-top')!

    for (const [scene, entity] of [
      [yonghe, interiorTable], [yonghe, interiorChair], [shrine, offeringTable], [shrine, incense], [yard, oldTree],
      [office, officeDesk], [office, officeChair], [office, officePlant], [eatery, yongheStove],
      [cafe, cafeFourSeatTable], [cafe, cafeFourSeatChair],
    ] as const) {
      const snapshot = createMainlineSceneGeometrySnapshot(scene, scene.initialPlayerPosition, {}, sceneDesignReferenceMetrics)
      expect(entity.movementCollision).not.toBe('physical')
      expect(snapshot.objects.get(entity.id)?.collision).toEqual(mainlineEntityTextFootprint(entity, snapshot.objects.get(entity.id)!.position, sceneDesignReferenceMetrics))
    }
    // The counter is a continuous run of visible glyph cells, not an ordinary
    // two-character object. Its collision belongs to that exact run once.
    const counterBody = eatery.continuousStructures.find(body => body.id === yongheCounter.interactionStructureId)!
    expect(counterBody).toBeDefined()
    // The mining street is now horizontal, so Yonghe's long counter runs
    // along X rather than down Y.
    expect(counterBody.width * 19.2).toBeCloseTo(256, 3)
    expect(counterBody.height * 10.8).toBeCloseTo(16, 3)
    const counterSnapshot = createMainlineSceneGeometrySnapshot(eatery, eatery.initialPlayerPosition, {}, sceneDesignReferenceMetrics)
    expect(counterSnapshot.objects.get(yongheCounter.id)!.collision).toBeNull()
  })
})
