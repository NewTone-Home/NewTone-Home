import { describe, expect, it } from 'vitest'
import {
  interactionTutorialCompletedStateKey,
  isInteractionTutorialCompleted,
  isTutorialCompletionTransition,
  mainlineInteractionCompletesImmediately,
  mainlineExploredObjectIdsFromSceneState,
  mainlineInteractionExploredStateKey,
  resolveMainlineInteractionVisualState,
} from '../src/center/runtime/mainlineInteractionVisualState'

describe('mainline interaction visual state', () => {
  it('keeps the tutorial milestone as a historical ride transition, not a current-scene rule', () => {
    expect(isTutorialCompletionTransition('zhongshuyuan-office', 'commercial-street', 'ride')).toBe(true)
    expect(isTutorialCompletionTransition('zhongshuyuan-office', 'commercial-street', 'resume')).toBe(false)
    expect(isTutorialCompletionTransition('commercial-street', 'zhongshuyuan-office', 'ride')).toBe(false)
    expect(isInteractionTutorialCompleted({ [interactionTutorialCompletedStateKey]: true })).toBe(true)
  })

  it('stores successful object exploration as independent persistent scene-state entries', () => {
    const treeKey = mainlineInteractionExploredStateKey('jijia-old-tree')
    const burnerKey = mainlineInteractionExploredStateKey('jijia-incense-burner')

    expect(mainlineExploredObjectIdsFromSceneState({ [treeKey]: true, [burnerKey]: false })).toEqual(new Set(['jijia-old-tree']))
  })

  it('uses active > explored > tutorial-unexplored > normal-unexplored precedence', () => {
    expect(resolveMainlineInteractionVisualState({ active: true, explored: true, tutorialCompleted: false, tutorialEligible: true })).toBe('active')
    expect(resolveMainlineInteractionVisualState({ active: false, explored: true, tutorialCompleted: false, tutorialEligible: true })).toBe('explored')
    expect(resolveMainlineInteractionVisualState({ active: false, explored: false, tutorialCompleted: false, tutorialEligible: true })).toBe('tutorial-unexplored')
    expect(resolveMainlineInteractionVisualState({ active: false, explored: false, tutorialCompleted: true, tutorialEligible: true })).toBe('normal-unexplored')
    expect(resolveMainlineInteractionVisualState({ active: false, explored: false, tutorialCompleted: false, tutorialEligible: false })).toBe('normal-unexplored')
  })

  it('finishes feedback-only interactions while keeping echo and dialogue interactions active', () => {
    expect(mainlineInteractionCompletesImmediately({ hasExplorationContent: false, startsDialogue: false })).toBe(true)
    expect(mainlineInteractionCompletesImmediately({ hasExplorationContent: true, startsDialogue: false })).toBe(false)
    expect(mainlineInteractionCompletesImmediately({ hasExplorationContent: false, startsDialogue: true })).toBe(false)
  })
})
