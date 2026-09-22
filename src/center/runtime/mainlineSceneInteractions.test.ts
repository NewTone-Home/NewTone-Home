import { describe, expect, it } from 'vitest'
import { mainlineSceneAreaLabel, mainlineScenes } from './mainlineScenes'
import { mainlineInteractionTarget } from './mainlineNavigation'
import {
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
      officeBlindsOpen: true,
      carriedPhoneDevice: 'surface',
    })
    expect(exploration.choice?.options).toEqual(['重新点香', '置之不理'])

    const choice = resolveMainlineSceneEchoChoice(scene, burner, '重新点香', 1234)
    expect(choice).toMatchObject({
      feedback: '修杰重新点上了香。',
      echoText: '重新点上了香。',
      clearOptions: true,
      stateChange: { key: 'incenseLitAt', value: 1234 },
    })
  })

  it('keeps old-tree echo text and wall portraits as authored scene behavior', () => {
    const yard = mainlineScenes['jijia-ancestral-home']
    const tree = entity('jijia-ancestral-home', 'jijia-old-tree')
    const echo = resolveMainlineSceneExploration(yard, tree, {
      incensePhase: 'unlit',
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
      officeBlindsOpen: true,
      carriedPhoneDevice: 'surface',
    })
    expect(deskChoice.choice?.options).toEqual(['里世界手机'])
    expect(resolveMainlineSceneEchoChoice(office, desk, '里世界手机', 0)?.deskDevice).toBe('inner')

    const window = entity('zhongshuyuan-office', 'zhongshuyuan-office-window')
    expect(resolveMainlineSceneEchoChoice(office, window, '打开百叶窗', 0)).toMatchObject({
      stateChange: { key: 'blindsOpen', value: true },
      echoOptions: ['拉上百叶窗'],
    })

    const commercial = mainlineScenes['commercial-street']
    expect(mainlineSceneAreaLabel(commercial, { ...commercial.initialPlayerPosition, x: commercial.walkBounds.x + commercial.walkBounds.width })).toBe('商业街尾端')
    const mining = mainlineScenes['yonghe-mining-perimeter']
    expect(mainlineSceneAreaLabel(mining, mining.initialPlayerPosition)).toBe('矿区')
  })

  it('uses the counter behavior to offer and persist one coffee order without advancing later cafe stages', () => {
    const cafe = mainlineScenes['commercial-cafe']
    const counter = entity('commercial-cafe', 'commercial-cafe-counter')
    const counterSegments = cafe.objects.filter((candidate) => candidate.id === 'commercial-cafe-counter' || candidate.id.startsWith('commercial-cafe-counter-'))
    const entered = resolveMainlineSceneExploration(cafe, counter, {
      incensePhase: 'unlit',
      officeBlindsOpen: true,
      carriedPhoneDevice: 'surface',
      commercialCafeStoryStage: 'entered',
    })

    expect(counter).toMatchObject({ kind: 'fixture', interactionBehavior: 'cafe-order' })
    expect(counterSegments).toHaveLength(17)
    expect(counterSegments.every((segment) => segment.interactionBehavior === 'cafe-order')).toBe(true)
    counterSegments.forEach((segment) => {
      const customerY = segment.collision!.y + segment.collision!.height + segment.collision!.height
      const left = mainlineInteractionTarget(cafe, segment.id, { x: segment.collision!.x - segment.collision!.width, y: customerY })
      const right = mainlineInteractionTarget(cafe, segment.id, { x: segment.collision!.x + segment.collision!.width * 2, y: customerY })
      expect(left.y).toBeGreaterThan(segment.collision!.y + segment.collision!.height)
      expect(right.y).toBeGreaterThan(segment.collision!.y + segment.collision!.height)
      expect(left.x).toBeLessThanOrEqual(segment.position.x)
      expect(right.x).toBeGreaterThanOrEqual(segment.position.x)
    })
    expect(entered.choice).toEqual({ text: '要点一杯咖啡吗？', options: ['点一杯咖啡'] })
    expect(resolveMainlineSceneEchoChoice(cafe, counter, '点一杯咖啡', 0, { commercialCafeStoryStage: 'entered' })).toMatchObject({
      stateChange: { key: 'commercialCafeStoryStage', value: 'coffee-ordered' },
      clearOptions: true,
    })
    expect(resolveMainlineSceneExploration(cafe, counter, {
      incensePhase: 'unlit',
      officeBlindsOpen: true,
      carriedPhoneDevice: 'surface',
      commercialCafeStoryStage: 'coffee-ordered',
    }).choice).toEqual({ text: '已经点过咖啡。' })
    expect(resolveMainlineSceneEchoChoice(cafe, counter, '点一杯咖啡', 0, { commercialCafeStoryStage: 'coffee-ordered' })?.stateChange).toBeUndefined()
    expect(resolveMainlineSceneEchoChoice(cafe, counter, '点一杯咖啡', 0, { commercialCafeStoryStage: 'intel-received' })?.stateChange).toBeUndefined()
  })
})
