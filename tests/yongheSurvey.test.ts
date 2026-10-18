import { describe, expect, it } from 'vitest'
import {
  yongheSurveyPointIds,
  yongheSurveyPointForEntity,
  yongheSurveyPointStateKey,
  yongheSurveyStatePatch,
  yongheSurveyStatusFromSceneState,
} from '../src/center/runtime/yongheSurvey'
import { mainlineScenes } from '../src/center/runtime/mainlineScenes'
import { findMainlinePathToEntity } from '../src/center/runtime/mainlineNavigation'

describe('Yonghe survey state', () => {
  it('keeps all four observation targets reachable and the back door locked', () => {
    const scene = mainlineScenes['yonghe-eatery']
    for (const entityId of ['yonghe-upper-left-group-table', 'yonghe-counter', 'yonghe-lower-right-group-table', 'yonghe-back-door']) {
      expect(findMainlinePathToEntity(scene, entityId, scene.initialPlayerPosition).path, entityId).not.toBeNull()
    }
    expect(scene.passages.find((passage) => passage.id === 'yonghe-back-door')?.access).toBe('locked')
    expect(scene.passages.find((passage) => passage.id === 'yonghe-street-entry')?.targetSceneId).toBe('yonghe-mining-perimeter')
  })

  it('keeps the four survey state IDs while anchoring them to real table, counter, and door entities', () => {
    expect(yongheSurveyPointForEntity('yonghe-upper-left-group-table')).toBe('tables')
    expect(yongheSurveyPointForEntity('yonghe-counter')).toBe('counter')
    expect(yongheSurveyPointForEntity('yonghe-counter-segment-8')).toBe('counter')
    expect(yongheSurveyPointForEntity('yonghe-lower-right-group-table')).toBe('central-lane')
    expect(yongheSurveyPointForEntity('yonghe-back-door')).toBe('back-door')
    expect(yongheSurveyPointIds).toEqual(['tables', 'counter', 'central-lane', 'back-door'])
  })

  it('treats legacy saves as not started', () => {
    expect(yongheSurveyStatusFromSceneState({ interactionExplored: true })).toBe('not-started')
  })

  it('keeps arbitrary point order and partial progress', () => {
    const first = yongheSurveyStatePatch({}, 'counter')
    const second = { ...first, ...yongheSurveyStatePatch(first, 'tables') }

    expect(first).toMatchObject({ yongheSurveyStatus: 'in-progress' })
    expect(second).toMatchObject({
      yongheSurveyStatus: 'in-progress',
      [yongheSurveyPointStateKey('counter')]: true,
      [yongheSurveyPointStateKey('tables')]: true,
    })
  })

  it('completes only after all four distinct points and preserves unknown fields', () => {
    const state = { unrelatedSceneValue: 'preserve' }
    const complete = yongheSurveyPointIds.reduce(
      (current, pointId) => ({ ...current, ...yongheSurveyStatePatch(current, pointId) }),
      state,
    )

    expect(yongheSurveyStatusFromSceneState(complete)).toBe('complete')
    expect(complete).toMatchObject({ unrelatedSceneValue: 'preserve', yongheSurveyStatus: 'complete' })
    expect(yongheSurveyStatePatch(complete, 'tables')).toMatchObject({ yongheSurveyStatus: 'complete' })
  })
})
