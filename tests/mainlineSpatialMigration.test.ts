import { describe, expect, it } from 'vitest'
import { defaultSceneScreenMetrics } from '../src/center/runtime/sceneBoundaryGrid'
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
    const cafeFourSeatTable = cafe.objects.find((entity) => entity.id === 'commercial-cafe-bottom-center-group-table')!
    const cafeFourSeatChair = cafe.objects.find((entity) => entity.id === 'commercial-cafe-bottom-center-group-chair-top')!

    for (const [scene, entity] of [
      [shrine, offeringTable], [shrine, incense], [yard, oldTree],
      [office, officeDesk], [office, officeChair], [office, officePlant],
      [cafe, cafeFourSeatTable], [cafe, cafeFourSeatChair],
    ] as const) {
      const snapshot = createMainlineSceneGeometrySnapshot(scene, scene.initialPlayerPosition, {}, defaultSceneScreenMetrics)
      expect(entity.movementCollision).not.toBe('physical')
      expect(snapshot.objects.get(entity.id)?.collision).toEqual(mainlineEntityTextFootprint(entity, snapshot.objects.get(entity.id)!.position, defaultSceneScreenMetrics))
    }
    expect(eatery.continuousStructures.find((structure) => structure.id === 'yonghe-counter-body')).toMatchObject({ x: 22.25, y: 26, width: 3.5, height: 22 })
    for (const entity of [interiorTable, interiorChair, yongheStove]) {
      expect(entity.movementCollision).toBe('physical')
      expect(entity.shape).toEqual(entity.collision)
    }
  })
})
