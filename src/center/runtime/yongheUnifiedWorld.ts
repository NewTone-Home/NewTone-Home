import type { PlayerChoiceValue, PlayerPoint, PlayerSave, PlayerSceneState } from './playerSave'
import { yongheSurveyPointIds, yongheSurveyPointStateKey, yongheSurveyStatusFromSceneState, yongheSurveyStatusStateKey } from './yongheSurvey'

/** One runtime world owns both mine regions; the eatery ID remains a save/URL alias. */
export const yongheWorldSceneId = 'yonghe-mining-perimeter' as const
export const yongheEateryLegacySceneId = 'yonghe-eatery' as const
export type YongheRegionId = 'perimeter' | 'eatery'
export const yongheCurrentRegionStateKey = 'yongheCurrentRegion'

export function yongheWorldSceneIdFor(sceneId: string): string {
  return yongheRegionForSceneId(sceneId) ? yongheWorldSceneId : sceneId
}

export function yongheRegionForSceneId(sceneId: string): YongheRegionId | null {
  if (sceneId === yongheWorldSceneId) return 'perimeter'
  if (sceneId === yongheEateryLegacySceneId) return 'eatery'
  return null
}

/** Both A1 blueprints already share the facade's authored coordinate frame. */
export function yongheLegacyPositionToWorld(position: PlayerPoint): PlayerPoint {
  return { x: position.x, y: position.y }
}

/** Merge the two historical survey buckets without losing either bucket's progress. */
export function migrateYongheSurveyState(save: PlayerSave): PlayerSave {
  const perimeter = save.sceneState[yongheWorldSceneId] ?? {}
  const eatery = save.sceneState[yongheEateryLegacySceneId] ?? {}
  const merged: PlayerSceneState = { ...eatery, ...perimeter }
  for (const pointId of yongheSurveyPointIds) {
    const key = yongheSurveyPointStateKey(pointId)
    if (key in perimeter || key in eatery) merged[key] = perimeter[key] === true || eatery[key] === true
  }
  const hasAnySurvey = yongheSurveyPointIds.some((pointId) => merged[yongheSurveyPointStateKey(pointId)] === true)
  if (hasAnySurvey) merged[yongheSurveyStatusStateKey] = yongheSurveyStatusFromSceneState(merged)
  if (Object.keys(merged).length === 0) return save
  return { ...save, sceneState: { ...save.sceneState, [yongheWorldSceneId]: merged } }
}

/** Keep the historic key intact while making its world position available to the unified runtime. */
export function yongheWorldPositionFromSave(save: PlayerSave, sceneId: string): PlayerPoint | null {
  const point = save.scenePositions[sceneId as keyof PlayerSave['scenePositions']]
  return point ? yongheLegacyPositionToWorld(point) : null
}

export function yongheCurrentRegionFromSave(save: PlayerSave): YongheRegionId {
  const region = save.sceneState[yongheWorldSceneId]?.[yongheCurrentRegionStateKey]
  return region === 'eatery' ? 'eatery' : 'perimeter'
}

export function yongheSceneStateValue(save: PlayerSave, key: string): PlayerChoiceValue | undefined {
  const canonical = save.sceneState[yongheWorldSceneId]?.[key]
  return canonical ?? save.sceneState[yongheEateryLegacySceneId]?.[key]
}
