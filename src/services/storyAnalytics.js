const completions = {
  commercialCafeStoryStatus: 'lao-zhou',
  commercialCafeRuoyuMeetingStatus: 'ruoyu',
}
export function storyCompletionTransitions(before, after) {
  const events = []
  const seen = new Set()
  for (const [sceneId, state] of Object.entries(after.sceneState ?? {})) {
    for (const [key, storyId] of Object.entries(completions)) {
      if (state[key] === 'complete' && before.sceneState?.[sceneId]?.[key] !== 'complete' && !seen.has(storyId)) {
        // A namespace migration is not a new story completion.
        if (Object.values(before.sceneState ?? {}).some(old => old[key] === 'complete')) continue
        seen.add(storyId)
        events.push({ name: 'center_interaction_completed', sceneId, objectId: storyId, objectKind: 'story', outcome: 'story-completed' })
      }
    }
  }
  return events
}
