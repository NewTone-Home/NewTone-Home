import { describe, expect, it } from 'vitest'
import { mainlineSceneAreaLabel, mainlineScenes } from './mainlineScenes'
import { mainlineInteractionTarget } from './mainlineNavigation'
import { commercialCafeCoffeeStatusKey } from './commercialCafeStory'
import {
  plantIsWatered,
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
      const names = ['修鞋', '永和小馆', '药店', '五金店', '小吃', '面馆', '修理', '早点']
      for (const [index, name] of names.entries()) {
        const roomId = `mining-shop-${index + 1}-interior`
        const room = scene.rooms.find(candidate => candidate.id === roomId)!
        expect(room).toBeDefined()
        expect(mainlineSceneAreaLabel(scene, { x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2 })).toBe(name)
        const door = scene.passages.find(candidate => candidate.toRoomId === roomId)!
        expect(door).toMatchObject({ access: index === 1 ? 'open' : 'locked', routeThrough: true, fromRoomId: 'mining-street-public-lane' })
        expect(door.targetSceneId).toBeUndefined()
      }
      expect(scene.passages.find(candidate => candidate.id === 'yonghe-back-door')).toMatchObject({ access: 'locked' })
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
    expect(entered.choice).toEqual({ text: '要点一杯咖啡吗？', options: ['点一杯咖啡'] })
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
    }).choice).toEqual({ text: '已经点过咖啡。' })
    expect(resolveMainlineSceneExploration(cafe, counter, {
      incensePhase: 'unlit', plantWatered: false, officeBlindsOpen: true, carriedPhoneDevice: 'surface', commercialCafeCoffeeOrdered: false, carriedMilkTea: true,
    }).choice).toEqual({ text: '已经有奶茶了，还要买咖啡吗？', options: ['是', '否'] })
    expect(resolveMainlineSceneEchoChoice(cafe, counter, '否', 0, { commercialCafeCoffeeOrdered: false, carriedMilkTea: true })?.stateChange).toBeUndefined()
    expect(resolveMainlineSceneEchoChoice(cafe, counter, '是', 0, { commercialCafeCoffeeOrdered: false, carriedMilkTea: true })?.stateChange).toEqual({ key: commercialCafeCoffeeStatusKey, value: 'ordered' })
  })
})
