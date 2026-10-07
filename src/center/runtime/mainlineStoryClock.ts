import type { MainlineSceneId } from './mainlineSceneModel'

export type MainlineStoryStage = 'opening' | 'commercial-street' | 'cafe' | 'yonghe'

export type MainlineStoryClock = {
  dayId: 'story-day-001'
  stage: MainlineStoryStage
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
  return { dayId: 'story-day-001', stage: mainlineStoryStageForScene(sceneId) ?? 'opening' }
}

export function advanceMainlineStoryClock(
  clock: MainlineStoryClock,
  sceneId: MainlineSceneId,
): MainlineStoryClock {
  const stage = mainlineStoryStageForScene(sceneId)
  if (!stage || stageOrder[stage] <= stageOrder[clock.stage]) return clock
  return { ...clock, stage }
}

export function mainlineStoryTimeLabel(stage: MainlineStoryStage): string {
  switch (stage) {
    case 'opening': return '10:00'
    case 'commercial-street': return '上午后段'
    case 'cafe': return '午休时段'
    case 'yonghe': return '午间至下午早段'
  }
}

export function mainlineStoryDateLabel(): string {
  return '四月 · 周六'
}

export function mainlineWorldWeatherLabel(device: 'surface' | 'inner'): string {
  return device === 'inner' ? '晴天周期 · 第六天' : '表世界'
}
