import type { MainlineSceneId } from './mainlineScenes'

export type MainlineLongDistanceTravelIntent = {
  kind: 'ride'
  sourceSceneId: MainlineSceneId
  targetSceneId: MainlineSceneId
}

const mainlineLongDistanceTravelRoutes: readonly MainlineLongDistanceTravelIntent[] = [
  { kind: 'ride', sourceSceneId: 'zhongshuyuan-office', targetSceneId: 'yonghe-mining-perimeter' },
  { kind: 'ride', sourceSceneId: 'yonghe-mining-perimeter', targetSceneId: 'zhongshuyuan-office' },
  { kind: 'ride', sourceSceneId: 'commercial-street', targetSceneId: 'yonghe-mining-perimeter' },
  { kind: 'ride', sourceSceneId: 'yonghe-mining-perimeter', targetSceneId: 'commercial-street' },
  {
    kind: 'ride',
    sourceSceneId: 'zhongshuyuan-office',
    targetSceneId: 'commercial-street',
  },
  {
    kind: 'ride',
    sourceSceneId: 'commercial-street',
    targetSceneId: 'zhongshuyuan-office',
  },
]

export const longDistanceTravelVehicleDurationMs = 1600
export const longDistanceTravelStatusPulseDurationMs = 360
export const longDistanceTravelStatusBeatProgress = [1 / 8, 17 / 32] as const
export const longDistanceTravelStatusPhrases = ['行驶中.', '行驶中..'] as const

export type LongDistanceTravelStatusBeat = {
  phrase: (typeof longDistanceTravelStatusPhrases)[number]
  delayMs: number
  visibleDurationMs: number
}

/** Presentation-only rhythm, derived from the same uninterrupted vehicle timeline. */
export function longDistanceTravelStatusBeats(): readonly LongDistanceTravelStatusBeat[] {
  const delays = longDistanceTravelStatusBeatProgress.map((progress) => Math.round(longDistanceTravelVehicleDurationMs * progress))
  return longDistanceTravelStatusPhrases.map((phrase, index) => ({
    phrase,
    delayMs: delays[index],
    visibleDurationMs: (delays[index + 1] ?? longDistanceTravelVehicleDurationMs) - delays[index],
  }))
}

/** Only explicitly enabled ride routes receive the long-distance presentation. */
export function mainlineLongDistanceTravelIntentForRide(sourceSceneId: MainlineSceneId, targetSceneId: MainlineSceneId): MainlineLongDistanceTravelIntent | null {
  return mainlineLongDistanceTravelRoutes.find((route) => (
    route.sourceSceneId === sourceSceneId && route.targetSceneId === targetSceneId
  )) ?? null
}
