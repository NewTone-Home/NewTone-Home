import type { PlayerSceneState } from './playerSave'

export const yongheSurveyPointIds = [
  'tables',
  'counter',
  'central-lane',
  'back-door',
] as const

export type YongheSurveyPointId = typeof yongheSurveyPointIds[number]
export type YongheSurveyStatus = 'not-started' | 'in-progress' | 'complete'

export const yongheSurveyPointStateKey = (pointId: YongheSurveyPointId) =>
  'yongheSurveyPoint:' + pointId

export const yongheSurveyStatusStateKey = 'yongheSurveyStatus'

export function yongheSurveyStatusFromSceneState(state: Readonly<PlayerSceneState> = {}): YongheSurveyStatus {
  const checked = yongheSurveyPointIds.filter((pointId) => state[yongheSurveyPointStateKey(pointId)] === true).length
  if (checked === yongheSurveyPointIds.length) return 'complete'
  return checked > 0 ? 'in-progress' : 'not-started'
}

export function yongheSurveyStatePatch(
  state: Readonly<PlayerSceneState>,
  pointId: YongheSurveyPointId,
): PlayerSceneState {
  const checkedPoints = new Set(
    yongheSurveyPointIds.filter((candidate) => state[yongheSurveyPointStateKey(candidate)] === true),
  )
  checkedPoints.add(pointId)
  return {
    [yongheSurveyPointStateKey(pointId)]: true,
    [yongheSurveyStatusStateKey]: checkedPoints.size === yongheSurveyPointIds.length ? 'complete' : 'in-progress',
  }
}

export function yongheSurveyPointForEntity(entityId: string): YongheSurveyPointId | null {
  switch (entityId) {
    case 'yonghe-upper-left-group-table': return 'tables'
    case 'yonghe-counter': return 'counter'
    case 'yonghe-survey-central-lane': return 'central-lane'
    case 'yonghe-back-door': return 'back-door'
    default: return null
  }
}
