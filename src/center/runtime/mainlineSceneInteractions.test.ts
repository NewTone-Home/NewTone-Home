import { describe, expect, it } from 'vitest'
import { mainlineSceneAreaLabel, mainlineScenes } from './mainlineScenes'
import { mainlineInteractionTarget } from './mainlineNavigation'
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
    expect(deskChoice.choice?.options).toEqual(['里世界手机'])
    expect(resolveMainlineSceneEchoChoice(office, desk, '里世界手机', 0)?.deskDevice).toBe('inner')

    const window = entity('zhongshuyuan-office', 'zhongshuyuan-office-window')
    expect(resolveMainlineSceneEchoChoice(office, window, '打开百叶窗', 0)).toMatchObject({
      stateChange: { key: 'blindsOpen', value: true },
      dismiss: true,
    })

    const commercial = mainlineScenes['commercial-street']
    expect(mainlineSceneAreaLabel(commercial, { ...commercial.initialPlayerPosition, x: commercial.walkBounds.x + commercial.walkBounds.width })).toBe('商业街尾端')
    const mining = mainlineScenes['yonghe-mining-perimeter']
    expect(mainlineSceneAreaLabel(mining, mining.initialPlayerPosition)).toBe('矿区')
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
    expect(plantIsWatered(4321, 4321 + 9 * 60 * 1000)).toBe(true)
    expect(plantIsWatered(4321, 4321 + 10 * 60 * 1000)).toBe(false)
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
    expect(counterSegments).toHaveLength(17)
    expect(counterSegments.every((segment) => segment.interactionBehavior === 'cafe-order')).toBe(true)
    const counterBody = cafe.continuousStructures.find((structure) => structure.id === 'commercial-cafe-counter-body')!
    // APPROVED CONTRACT MIGRATION: cells retain individual customer-side
    // contacts but share one continuous physical counter body.
    counterSegments.forEach((segment) => {
      const customerY = counterBody.y + counterBody.height * 2
      const left = mainlineInteractionTarget(cafe, segment.id, { x: counterBody.x - counterBody.width, y: customerY })
      const right = mainlineInteractionTarget(cafe, segment.id, { x: counterBody.x + counterBody.width * 2, y: customerY })
      expect(left.y).toBeGreaterThan(counterBody.y + counterBody.height)
      expect(right.y).toBeGreaterThan(counterBody.y + counterBody.height)
      expect(left.x).toBeLessThanOrEqual(segment.position.x)
      expect(right.x).toBeGreaterThanOrEqual(segment.position.x)
    })
    expect(entered.choice).toEqual({ text: '要点一杯咖啡吗？', options: ['点一杯咖啡'] })
    expect(resolveMainlineSceneEchoChoice(cafe, counter, '点一杯咖啡', 0, { commercialCafeCoffeeOrdered: false, carriedMilkTea: false })).toMatchObject({
      stateChange: { key: 'commercialCafeCoffeeOrdered', value: true },
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
    expect(resolveMainlineSceneEchoChoice(cafe, counter, '是', 0, { commercialCafeCoffeeOrdered: false, carriedMilkTea: true })?.stateChange).toEqual({ key: 'commercialCafeCoffeeOrdered', value: true })
  })
})
