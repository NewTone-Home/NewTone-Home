import { describe, expect, it } from 'vitest'
import { mainlineSceneAreaLabel, mainlineScenes } from './mainlineScenes'
import { mainlineInteractionTarget, resolveMainlineEntityInteraction } from './mainlineNavigation'
import { sceneDesignReferenceMetrics } from './sceneBoundaryGrid'
import { mainlineDoorPortalShouldRender } from './mainlineSceneVisibility'
import { commercialCafeCoffeeStatusKey } from './commercialCafeStory'
import {
  plantIsWatered,
  mainlineExplorationChoiceIsActionOnly,
  isMainlineInPlaceInteraction,
  resolveMainlineSceneEchoChoice,
  resolveMainlineSceneExploration,
} from './mainlineSceneInteractions'

function entity(sceneId: keyof typeof mainlineScenes, entityId: string) {
  const result = mainlineScenes[sceneId].objects.find((candidate) => candidate.id === entityId)
  if (!result) throw new Error(`Missing entity ${entityId} in ${sceneId}`)
  return result
}

describe('mainline scene interaction policies', () => {
  it('gives the Yonghe warehouse one action and returns only its result after selection', () => {
    const scene = mainlineScenes['yonghe-mining-perimeter']
    const door = entity('yonghe-mining-perimeter', 'yonghe-warehouse-door')
    expect(door.spaceId).toBe('mining-street-back-alley')
    expect(mainlineDoorPortalShouldRender(door, 'mining-street-back-alley')).toBe(true)
    expect(mainlineDoorPortalShouldRender(door, 'mining-shop-2-interior')).toBe(false)
    expect(mainlineDoorPortalShouldRender(undefined, 'mining-shop-2-interior')).toBe(true)
    expect(scene.passages.find(passage => passage.id === 'yonghe-warehouse-door')).toMatchObject({ access: 'locked', toRoomId: undefined })
    expect(scene.passages.find(passage => passage.id === 'yonghe-back-door')).toMatchObject({ access: 'open', toRoomId: 'mining-shop-2-interior' })
    const exploration = resolveMainlineSceneExploration(scene, door, {
      incensePhase: 'unlit', plantWatered: false, officeBlindsOpen: true, carriedPhoneDevice: 'surface',
    })
    expect(exploration.choice).toEqual({ text: '', options: ['推一下门'] })
    expect(mainlineExplorationChoiceIsActionOnly(exploration.choice)).toBe(true)
    expect(mainlineExplorationChoiceIsActionOnly({ text: '门锁着。', options: ['推一下门'] })).toBe(false)
    expect(mainlineExplorationChoiceIsActionOnly({ text: '', options: [] })).toBe(false)
    const alley = scene.rooms.find(room => room.id === 'mining-street-back-alley')!
    const alleyCenter = { x: alley.bounds.x + alley.bounds.width / 2, y: alley.bounds.y + alley.bounds.height / 2 }
    const approach = resolveMainlineEntityInteraction(scene, door.id, alleyCenter, {}, {
      screenMetrics: sceneDesignReferenceMetrics, actorFootprint: { width: 16 / 19.2, height: 16 / 10.8 },
    })
    expect(approach.path, 'the locked warehouse door remains interactable from the alley side').not.toBeNull()
    expect(resolveMainlineSceneEchoChoice(scene, door, '推一下门', 0)).toEqual({
      dismiss: true, followupText: '门锁着，打不开。',
    })
    expect(resolveMainlineSceneEchoChoice(scene, door, '\u968f\u4fbf\u770b\u770b', 0)).toMatchObject({ dismiss: true, followupText: undefined })
  })

  it('keeps incense phase choices and state effects independent of scene IDs', () => {
    const scene = mainlineScenes['jijia-ancestral-interior']
    const burner = entity('jijia-ancestral-interior', 'jijia-incense-burner')
    const exploration = resolveMainlineSceneExploration(scene, burner, {
      incensePhase: 'burned',
      plantWatered: false,
      officeBlindsOpen: true,
      carriedPhoneDevice: 'surface',
    })
    expect(exploration.choice?.options).toEqual(['重新点香'])

    const choice = resolveMainlineSceneEchoChoice(scene, burner, '重新点香', 1234)
    expect(choice).toMatchObject({
      dismiss: true,
      stateChange: { key: 'incenseLitAt', value: 1234 },
    })
  })

  it('keeps old-tree echo text and wall portraits as authored scene behavior', () => {
    const yard = mainlineScenes['jijia-ancestral-home']
    const tree = entity('jijia-ancestral-home', 'jijia-old-tree')
    const echo = resolveMainlineSceneExploration(yard, tree, {
      incensePhase: 'unlit',
      plantWatered: false,
      officeBlindsOpen: true,
      carriedPhoneDevice: 'surface',
    })
    expect(echo.pool).toBe(yard.echoPool)

    const interior = mainlineScenes['jijia-ancestral-interior']
    const portrait = entity('jijia-ancestral-interior', 'jijia-portrait-top-1')
    expect(isMainlineInPlaceInteraction(portrait)).toBe(true)
    expect(interior.explorationText?.[portrait.id]).toBeDefined()
  })

  it('keeps office choices and scene labels data-driven', () => {
    const office = mainlineScenes['zhongshuyuan-office']
    const desk = entity('zhongshuyuan-office', 'zhongshuyuan-office-desk')
    const deskChoice = resolveMainlineSceneExploration(office, desk, {
      incensePhase: 'unlit',
      plantWatered: false,
      officeBlindsOpen: true,
      carriedPhoneDevice: 'surface',
    })
    expect(deskChoice.choice?.options).toEqual(['换手机'])
    expect(resolveMainlineSceneEchoChoice(office, desk, '换手机', 0)?.deskDevice).toBe('inner')

    const window = entity('zhongshuyuan-office', 'zhongshuyuan-office-window')
    expect(resolveMainlineSceneEchoChoice(office, window, '打开窗帘', 0)).toMatchObject({
      stateChange: { key: 'blindsOpen', value: true },
      dismiss: true,
    })

    const commercial = mainlineScenes['commercial-street']
    expect(mainlineSceneAreaLabel(commercial, { ...commercial.initialPlayerPosition, x: commercial.walkBounds.x + commercial.walkBounds.width })).toBe('商业街尾端')
    const mining = mainlineScenes['yonghe-mining-perimeter']
    // f7236ee replaced the generic mine display with a continuous street.
    // The legacy scene key is retained separately; this assertion is UI area text.
    expect(mainlineSceneAreaLabel(mining, mining.initialPlayerPosition)).toBe('矿区外围老街')
  })

  it('retains both historic mine scene keys while reporting the real street and interior area', () => {
    for (const key of ['yonghe-mining-perimeter', 'yonghe-eatery'] as const) {
      const scene = mainlineScenes[key]
      expect(scene).toBeDefined()
      expect(scene.statusLabel).toBe('矿区外围老街')
      expect(mainlineSceneAreaLabel(scene, scene.initialPlayerPosition)).toBe('矿区外围老街')
      const names = ['\u6d17\u8863\u5e97', '\u6c38\u548c\u5c0f\u9986', '\u836f\u5e97', '\u4e94\u91d1\u5e97', '\u4fbf\u5229\u5e97', '\u65c5\u5e97', '\u7535\u5668\u7ef4\u4fee', '\u7406\u53d1\u5e97']
      for (const [index, name] of names.entries()) {
        const roomId = `mining-shop-${index + 1}-interior`
        const room = scene.rooms.find(candidate => candidate.id === roomId)!
        expect(room).toBeDefined()
        expect(mainlineSceneAreaLabel(scene, { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 })).toBe(name)
        const door = scene.passages.find(candidate => candidate.toRoomId === roomId)!
        expect(door).toMatchObject({ access: index === 1 ? 'open' : 'locked', routeThrough: true, fromRoomId: 'mining-street-public-lane' })
        expect(door.targetSceneId).toBeUndefined()
      }
      expect(scene.passages.find(candidate => candidate.id === 'yonghe-back-door')).toMatchObject({ access: 'open', fromRoomId: 'mining-street-back-alley', toRoomId: 'mining-shop-2-interior' })
    }
  })

  it('persists watering as a bounded plant state instead of feedback-only UI', () => {
    const office = mainlineScenes['zhongshuyuan-office']
    const plant = entity('zhongshuyuan-office', 'zhongshuyuan-office-plant')
    expect(resolveMainlineSceneExploration(office, plant, {
      incensePhase: 'unlit', plantWatered: false, officeBlindsOpen: true, carriedPhoneDevice: 'surface',
    }).choice).toEqual({ text: '有段时间没浇水了，不那么精神了。', options: ['浇水'] })
    expect(resolveMainlineSceneEchoChoice(office, plant, '浇水', 4321)).toEqual({
      dismiss: true,
      stateChange: { key: 'plantWateredAt', value: 4321 },
    })
    expect(plantIsWatered(4321, 4321 + 3 * 60 * 1000)).toBe(true)
    expect(plantIsWatered(4321, 4321 + 4 * 60 * 1000)).toBe(false)
  })

  it('keeps coffee optional and asks for confirmation only when the protagonist carries milk tea', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const counter = entity('commercial-cafe', 'commercial-cafe-counter')
    const counterSegments = cafe.objects.filter((candidate) => candidate.id === 'commercial-cafe-counter' || candidate.id.startsWith('commercial-cafe-counter-'))
    const entered = resolveMainlineSceneExploration(cafe, counter, {
      incensePhase: 'unlit',
      plantWatered: false,
      officeBlindsOpen: true,
      carriedPhoneDevice: 'surface',
      commercialCafeCoffeeOrdered: false,
      carriedMilkTea: false,
    })

    expect(counter).toMatchObject({ kind: 'fixture', interactionBehavior: 'cafe-order' })
    expect(counterSegments).toHaveLength(1)
    expect(counterSegments.every((segment) => segment.interactionBehavior === 'cafe-order')).toBe(true)
    const counterBody = cafe.continuousStructures.find((structure) => structure.id === 'cafe-trial-counter-long-body')!
    // APPROVED CONTRACT MIGRATION: cells retain individual customer-side
    // contacts but share one continuous physical counter body.
    const inside=cafe.passages.find(p=>p.id==='street-cafe-entry')!.crossingTargets[0]
    for (const segment of counterSegments) {
      const target=mainlineInteractionTarget(cafe,segment.id,inside,{},undefined,{screenMetrics:{width:1920,height:1080}})
      expect(target.x).toBeGreaterThan(counterBody.x+counterBody.width)
      expect(segment.id).toBe('commercial-cafe-counter')
    }
    expect(entered.choice).toEqual({ text: '想喝点什么呢？', options: ['点一杯咖啡'] })
    expect(resolveMainlineSceneEchoChoice(cafe, counter, '点一杯咖啡', 0, { commercialCafeCoffeeOrdered: false, carriedMilkTea: false })).toMatchObject({
      stateChange: { key: commercialCafeCoffeeStatusKey, value: 'ordered' },
      dismiss: true,
    })
    expect(resolveMainlineSceneExploration(cafe, counter, {
      incensePhase: 'unlit',
      plantWatered: false,
      officeBlindsOpen: true,
      carriedPhoneDevice: 'surface',
      commercialCafeCoffeeOrdered: true,
      carriedMilkTea: false,
    }).choice).toEqual({ text: '咖啡已经点过了。' })
    expect(resolveMainlineSceneExploration(cafe, counter, {
      incensePhase: 'unlit', plantWatered: false, officeBlindsOpen: true, carriedPhoneDevice: 'surface', commercialCafeCoffeeOrdered: false, carriedMilkTea: true,
    }).choice).toEqual({ text: '手里已经有奶茶了，还要点咖啡吗？', options: ['是', '否'] })
    expect(resolveMainlineSceneEchoChoice(cafe, counter, '否', 0, { commercialCafeCoffeeOrdered: false, carriedMilkTea: true })?.stateChange).toBeUndefined()
    expect(resolveMainlineSceneEchoChoice(cafe, counter, '是', 0, { commercialCafeCoffeeOrdered: false, carriedMilkTea: true })?.stateChange).toEqual({ key: commercialCafeCoffeeStatusKey, value: 'ordered' })
  })
})
