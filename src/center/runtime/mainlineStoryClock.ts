import type { MainlineSceneId } from './mainlineSceneModel'

export type MainlineStoryStage = 'opening' | 'commercial-street' | 'cafe' | 'yonghe'

export type MainlineStoryClock = {
  dayId: 'story-day-001'
  stage: MainlineStoryStage
  month?: number
  day?: number
  weekday?: number
  hour?: number
  minute?: number
  weatherCycle?: 'sunny' | 'rainy'
}

const stageOrder: Record<MainlineStoryStage, number> = {
  opening: 0,
  'commercial-street': 1,
  cafe: 2,
  yonghe: 3,
}

export function mainlineStoryStageForScene(sceneId: MainlineSceneId): MainlineStoryStage | null {
  if (sceneId === 'jijia-ancestral-home' || sceneId === 'jijia-ancestral-interior') return 'opening'
  if (sceneId === 'commercial-street') return 'commercial-street'
  if (sceneId === 'commercial-cafe') return 'cafe'
  if (sceneId === 'yonghe-mining-perimeter' || sceneId === 'yonghe-eatery') return 'yonghe'
  return null
}

export function createInitialMainlineStoryClock(sceneId: MainlineSceneId): MainlineStoryClock {
  return storyClockForStage(mainlineStoryStageForScene(sceneId) ?? 'opening')
}

export function advanceMainlineStoryClock(
  clock: MainlineStoryClock,
  sceneId: MainlineSceneId,
): MainlineStoryClock {
  const stage = mainlineStoryStageForScene(sceneId)
  if (!stage || stageOrder[stage] <= stageOrder[clock.stage]) return clock
  return storyClockForStage(stage)
}

export function storyClockForStage(stage: MainlineStoryStage): MainlineStoryClock {
  const times = { opening: [10, 0], 'commercial-street': [11, 0], cafe: [12, 0], yonghe: [12, 30] }
  const [hour, minute] = times[stage]
  return { dayId: 'story-day-001', stage, month: 4, day: 12, weekday: 6, hour, minute, weatherCycle: 'sunny' }
}

export function mainlineStoryTimeLabel(stage: MainlineStoryStage): string {
  const clock = storyClockForStage(stage)
  return `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`
}
export function mainlineStoryDateLabel(): string { return '4月12日' }
export function mainlineWorldWeatherLabel(_device: 'surface' | 'inner', cycle: 'sunny' | 'rainy' = 'sunny'): string {
  return cycle === 'rainy' ? '🌧 14°' : '☀ 18°'
}
