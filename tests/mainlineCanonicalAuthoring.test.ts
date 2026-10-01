import { describe, expect, it } from 'vitest'
import { resolveMainlineSceneExploration } from '../src/center/runtime/mainlineSceneInteractions'
import { isWalkableMainlinePoint } from '../src/center/runtime/mainlineNavigation'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'

describe('canonical mainline scene authoring', () => {
  it('keeps the yard gate portal-owned while preserving its split boundary label and exit', () => {
    const yard = mainlineScenes['jijia-ancestral-home']
    const gateObjects = yard.objects.filter((entity) => entity.id === 'jijia-yard-gate')
    const gatePortals = yard.portals.filter((portal) => portal.id === 'jijia-yard-gate')
    const splitLabelParts = yard.geometry
      .flatMap((unit) => unit.visual.cells)
      .filter((cell) => cell.entityId === 'jijia-yard-gate' && cell.doorLabelPart)
      .map((cell) => cell.doorLabelPart)

    expect(gateObjects).toHaveLength(1)
    expect(gatePortals).toHaveLength(1)
    expect(yard.externalExit?.triggerEntityId).toBe('jijia-yard-gate')
    expect(splitLabelParts).toEqual(['院', '门'])
    expect(yard.objects.filter((entity) => entity.id === 'jijia-old-tree')).toHaveLength(1)
  })

  it('uses the same secret-door identity on both sides of the passage and keeps both safe entries walkable', () => {
    const passageScene = mainlineScenes['zhongshuyuan-passage']
    const office = mainlineScenes['zhongshuyuan-office']
    const passageToOffice = passageScene.passages.find((passage) => passage.targetSceneId === 'zhongshuyuan-office')!
    const officeToPassage = office.passages.find((passage) => passage.targetSceneId === 'zhongshuyuan-passage')!

    expect(passageToOffice.id).toBe('zhongshuyuan-office-secret-door')
    expect(passageToOffice.entityId).toBe('zhongshuyuan-office-secret-door')
    expect(officeToPassage.id).toBe('zhongshuyuan-office-secret-door')
    expect(officeToPassage.entityId).toBe('zhongshuyuan-office-secret-door')
    expect(passageToOffice.entryPosition).toBeTruthy()
    expect(isWalkableMainlinePoint(passageToOffice.entryPosition!, office)).toBe(true)
    expect(isWalkableMainlinePoint(passageScene.initialPlayerPosition, passageScene)).toBe(true)
  })

  it('keeps behavior-owned Actions as the only authoring source of truth', () => {
    const interior = mainlineScenes['jijia-ancestral-interior']
    const office = mainlineScenes['zhongshuyuan-office']
    const cafe = mainlineScenes['commercial-cafe']
    const entity = (scene: typeof interior, id: string) => scene.objects.find((candidate) => candidate.id === id)!
    const base = { incensePhase: 'burned' as const, plantWatered: false, officeBlindsOpen: true, carriedPhoneDevice: 'surface' as const }

    expect('explorationChoices' in interior).toBe(false)
    expect('explorationChoices' in office).toBe(false)
    expect(resolveMainlineSceneExploration(interior, entity(interior, 'jijia-incense-burner'), base).choice?.options).toEqual(['重新点香'])
    expect(resolveMainlineSceneExploration(office, entity(office, 'zhongshuyuan-office-plant'), base).choice?.options).toEqual(['浇水'])
    expect(resolveMainlineSceneExploration(office, entity(office, 'zhongshuyuan-office-window'), base).choice?.options).toEqual(['拉上百叶窗'])
    expect(resolveMainlineSceneExploration(office, entity(office, 'zhongshuyuan-office-desk'), base).choice?.options).toEqual(['里世界手机'])
    expect(resolveMainlineSceneExploration(cafe, entity(cafe, 'commercial-cafe-counter'), base).choice?.options).toEqual(['点一杯咖啡'])
  })
})
