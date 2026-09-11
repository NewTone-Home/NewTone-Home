/** Shared visual motion budget for scene frames. */
export const sceneFocusMotionMs = 1500

/** Shorter motion used by non-passage exploration frames. */
export const sceneExplorationMotionMs = 900

/** Keep the fixed yard gate between passage and exploration pacing. */
export const sceneGateMotionMs = 1100

export function sceneFocusMotionForPolicy(policy: string) {
  if (policy === 'exploration' || policy === 'interactive') return sceneExplorationMotionMs
  if (policy === 'gate') return sceneGateMotionMs
  return sceneFocusMotionMs
}
