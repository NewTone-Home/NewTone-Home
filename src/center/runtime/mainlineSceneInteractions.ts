import type { PhoneDevice } from './phoneState'
import type { PlayerChoiceValue } from './playerSave'
import type { MainlineInteractionBehavior } from './mainlineSceneModel'
import type { MainlineSceneDefinition, MainlineSceneEntity } from './mainlineScenes'
import { commercialCafeCoffeeOrderedKey } from './commercialCafeStory'

export const incenseBurnDurationMs = 10 * 60 * 1000

export type IncenseBurnPhase = 'unlit' | 'fresh' | 'half' | 'burned'

export type MainlineSceneInteractionContext = {
  incensePhase: IncenseBurnPhase
  officeBlindsOpen: boolean
  carriedPhoneDevice: PhoneDevice
  commercialCafeCoffeeOrdered?: boolean
  carriedMilkTea?: boolean
}

export type MainlineExplorationChoice = {
  text: string
  options?: readonly string[]
}

export type MainlineExplorationResolution = {
  choice?: MainlineExplorationChoice
  pool?: readonly string[]
}

export type MainlineSceneStateChange = {
  key: 'blindsOpen' | 'incenseLitAt' | typeof commercialCafeCoffeeOrderedKey
  value: PlayerChoiceValue
}

export type MainlineSceneEchoChoiceResolution = {
  feedback: string
  dismiss?: boolean
  clearOptions?: boolean
  echoText?: string
  echoOptions?: readonly string[]
  stateChange?: MainlineSceneStateChange
  deskDevice?: PhoneDevice
}

export function incenseBurnPhase(litAt: number | null, now: number): IncenseBurnPhase {
  if (litAt === null) return 'unlit'
  const elapsed = now - litAt
  if (elapsed >= incenseBurnDurationMs) return 'burned'
  if (elapsed >= incenseBurnDurationMs / 2) return 'half'
  return 'fresh'
}

export function incenseBurnRemainingMs(litAt: number | null, now: number) {
  return litAt === null
    ? 0
    : Math.max(0, incenseBurnDurationMs - (now - litAt))
}

function incenseExplorationChoice(phase: IncenseBurnPhase): MainlineExplorationChoice {
  if (phase === 'fresh') return { text: '重新点上了香。' }
  if (phase === 'half') return { text: '重新点上的香已经烧到了一半。' }
  return { text: '香早就烧完了，只剩根部伫立在里面。', options: ['重新点香', '置之不理'] }
}

function interactionBehavior(entity: MainlineSceneEntity): MainlineInteractionBehavior | undefined {
  return entity.interactionBehavior
}

export function resolveMainlineSceneExploration(
  scene: MainlineSceneDefinition,
  entity: MainlineSceneEntity,
  context: MainlineSceneInteractionContext,
): MainlineExplorationResolution {
  const behavior = interactionBehavior(entity)
  const configuredChoice = scene.explorationChoices?.[entity.id]

  if (behavior === 'incense') {
    return { choice: incenseExplorationChoice(context.incensePhase) }
  }
  if (behavior === 'desk-device') {
    return {
      choice: {
        text: scene.explorationText?.[entity.id]?.[0] ?? scene.interactionText[entity.id] ?? '',
        options: [context.carriedPhoneDevice === 'surface' ? '里世界手机' : '表世界手机'],
      },
    }
  }
  if (behavior === 'blinds-toggle') {
    return {
      choice: {
        text: context.officeBlindsOpen ? (scene.explorationText?.[entity.id] ?? []).join('\n') : '',
        options: [context.officeBlindsOpen ? '拉上百叶窗' : '打开百叶窗'],
      },
    }
  }
  if (behavior === 'cafe-order') {
    if (context.commercialCafeCoffeeOrdered) return { choice: { text: '已经点过咖啡。' } }
    return context.carriedMilkTea
      ? { choice: { text: '已经有奶茶了，还要买咖啡吗？', options: ['是', '否'] } }
      : { choice: { text: '要点一杯咖啡吗？', options: ['点一杯咖啡'] } }
  }

  if (configuredChoice) return { choice: configuredChoice }
  if (scene.explorationText?.[entity.id]) return { pool: scene.explorationText[entity.id] }
  if (behavior === 'echo-pool') return { pool: scene.echoPool }
  return {}
}

export function isMainlineInPlaceInteraction(entity: MainlineSceneEntity) {
  return entity.interactionBehavior === 'direct-wall'
}

export function resolveMainlineSceneEchoChoice(
  scene: MainlineSceneDefinition,
  entity: MainlineSceneEntity | undefined,
  option: string,
  now: number,
  context: Pick<MainlineSceneInteractionContext, 'commercialCafeCoffeeOrdered' | 'carriedMilkTea'> = {},
): MainlineSceneEchoChoiceResolution | null {
  const behavior = entity ? interactionBehavior(entity) : undefined

  if (behavior === 'desk-device') {
    return {
      feedback: '',
      dismiss: true,
      deskDevice: option === '里世界手机' ? 'inner' : 'surface',
    }
  }
  if (behavior === 'blinds-toggle') {
    const open = option === '打开百叶窗'
    return {
      feedback: '',
      stateChange: { key: 'blindsOpen', value: open },
      echoText: open ? (scene.explorationText?.[entity?.id ?? ''] ?? []).join('\n') : '',
      echoOptions: [open ? '拉上百叶窗' : '打开百叶窗'],
    }
  }
  if (behavior === 'plant-choice') {
    return {
      feedback: option === '浇水' ? '修杰给绿植浇了水。' : '修杰没有理会绿植。',
      clearOptions: true,
    }
  }
  if (behavior === 'incense') {
    if (option === '重新点香') {
      return {
        feedback: '修杰重新点上了香。',
        stateChange: { key: 'incenseLitAt', value: now },
        echoText: '重新点上了香。',
        clearOptions: true,
      }
    }
    return {
      feedback: '修杰没有理会香炉。',
      clearOptions: true,
    }
  }
  if (behavior === 'cafe-order') {
    if (context.commercialCafeCoffeeOrdered) {
      return { feedback: '已经点过咖啡。', clearOptions: true }
    }
    if (context.carriedMilkTea && option === '否') return { feedback: '修杰没有点咖啡。', clearOptions: true }
    if (option !== '点一杯咖啡' && option !== '是') return { feedback: '修杰没有点咖啡。', clearOptions: true }
    return {
      feedback: '修杰点了一杯咖啡。',
      echoText: '已经点了一杯咖啡。',
      clearOptions: true,
      stateChange: { key: commercialCafeCoffeeOrderedKey, value: true },
    }
  }

  return null
}
