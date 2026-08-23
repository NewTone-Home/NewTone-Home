function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Builds the persistent presentation flow used by Reader.
 *
 * Scene remains the authored structural unit. The Reader renders the ordered
 * Scene content as one continuous scroll flow and keeps the Scene boundary
 * indices only for metadata and boundary affordances.
 */
export function createReaderFlow(sceneModel) {
  const beats = []
  const locations = []
  const sceneBoundaries = []

  sceneModel.scenes.forEach((scene, sceneIndex) => {
    const startIndex = beats.length
    beats.push(...scene.beats)
    locations.push(...scene.locations)
    const endIndex = beats.length - 1

    if (sceneIndex < sceneModel.scenes.length - 1 && endIndex >= startIndex) {
      sceneBoundaries.push(Object.freeze({
        fromIndex: endIndex,
        toIndex: endIndex + 1,
        fromSceneId: scene.id,
        toSceneId: scene.next?.id ?? sceneModel.scenes[sceneIndex + 1]?.id ?? null,
      }))
    }
  })

  return Object.freeze({
    beats: Object.freeze(beats),
    locations: Object.freeze(locations),
    sceneBoundaries: Object.freeze(sceneBoundaries),
  })
}

/**
 * Returns the boundary progress currently under the Reader's center line.
 * 0 means the previous Scene's last unit is centered; 1 means the next
 * Scene's first unit is centered. Outside a boundary handoff, the control is
 * fully retracted.
 */
export function getSceneBoundaryProgress(viewport, flowElement, sceneBoundaries = []) {
  if (!viewport || !flowElement || sceneBoundaries.length === 0) return 1

  const viewportRect = viewport.getBoundingClientRect()
  const centerY = viewportRect.top + viewport.clientHeight / 2
  let best = null

  sceneBoundaries.forEach(boundary => {
      const from = flowElement.children[boundary.fromIndex]
      const to = flowElement.children[boundary.toIndex]
    if (!from || !to) return

    const fromRect = from.getBoundingClientRect()
    const toRect = to.getBoundingClientRect()
    const fromCenter = fromRect.top + fromRect.height / 2
    const toCenter = toRect.top + toRect.height / 2
    const span = fromCenter - toCenter
    if (Math.abs(span) < 1) return

    const rawProgress = (fromCenter - centerY) / span
    if (rawProgress < -0.02 || rawProgress > 1.02) return

    const progress = clamp(rawProgress)
    const distanceToBoundaryEdge = Math.min(progress, 1 - progress)
    if (!best || distanceToBoundaryEdge < best.distanceToBoundaryEdge) {
      best = { ...boundary, progress, distanceToBoundaryEdge }
    }
  })

  return best?.progress ?? 1
}
