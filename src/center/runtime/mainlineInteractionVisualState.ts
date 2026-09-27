import type { MainlineSceneId } from './mainlineSceneModel'
import type { PlayerSceneState } from './playerSave'

/**
 * A historical player milestone: interaction breathing is only an onboarding
 * affordance, so returning to an early scene must not restart it.
 */
export const interactionTutorialCompletedStateKey = 'interactionTutorialCompleted'

const interactionExploredStatePrefix = 'interactionExplored:'

export type MainlineInteractionVisualState =
  | 'active'
  | 'explored'
  | 'tutorial-unexplored'
  | 'normal-unexplored'

export function mainlineInteractionExploredStateKey(entityId: string) {
  return `${interactionExploredStatePrefix}${entityId}`
}

export function mainlineExploredObjectIdsFromSceneState(sceneState: PlayerSceneState | undefined): ReadonlySet<string> {
  if (!sceneState) return new Set()
  return new Set(Object.entries(sceneState)
    .filter(([key, value]) => key.startsWith(interactionExploredStatePrefix) && value === true)
    .map(([key]) => key.slice(interactionExploredStatePrefix.length)))
}

export function isInteractionTutorialCompleted(sceneState: PlayerSceneState | undefined) {
  return sceneState?.[interactionTutorialCompletedStateKey] === true
}

/** The tutorial completes at its actual narrative boundary, not by location. */
export function isTutorialCompletionTransition(
  fromSceneId: MainlineSceneId,
  toSceneId: MainlineSceneId,
  spawnMode: 'resume' | 'ride' | undefined,
) {
  return fromSceneId === 'zhongshuyuan-office'
    && toSceneId === 'commercial-street'
    && spawnMode === 'ride'
}

/**
 * A feedback-only object has no echo, dialogue, choice, or sustained state to
 * own its active presentation. It completes after its accepted click is
 * visually acknowledged.
 */
export function mainlineInteractionCompletesImmediately({
  hasExplorationContent,
  startsDialogue,
}: {
  hasExplorationContent: boolean
  startsDialogue: boolean
}) {
  return !hasExplorationContent && !startsDialogue
}

export function resolveMainlineInteractionVisualState({
  active,
  explored,
  tutorialCompleted,
  tutorialEligible,
}: {
  active: boolean
  explored: boolean
  tutorialCompleted: boolean
  tutorialEligible: boolean
}): MainlineInteractionVisualState {
  if (active) return 'active'
  if (explored) return 'explored'
  if (!tutorialCompleted && tutorialEligible) return 'tutorial-unexplored'
  return 'normal-unexplored'
}
