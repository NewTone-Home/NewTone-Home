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
  const sceneRanges = []

  sceneModel.scenes.forEach(scene => {
    const startIndex = beats.length
    beats.push(...scene.beats)
    locations.push(...scene.locations)
    const endIndex = beats.length - 1
    sceneRanges.push(Object.freeze({ sceneId: scene.id, startIndex, endIndex }))
  })

  const sceneBoundaries = sceneRanges.slice(0, -1).map((range, index) => {
    const nextRange = sceneRanges[index + 1]
    return Object.freeze({
      fromIndex: range.endIndex,
      toIndex: nextRange.startIndex,
      toEndIndex: nextRange.endIndex,
      fromSceneId: range.sceneId,
      toSceneId: nextRange.sceneId,
    })
  })

  return Object.freeze({
    beats: Object.freeze(beats),
    locations: Object.freeze(locations),
    sceneRanges: Object.freeze(sceneRanges),
    sceneBoundaries: Object.freeze(sceneBoundaries),
  })
}

/**
 * Returns the boundary progress currently under the Reader's center line.
 * 0 means the previous Scene's last unit is centered; 1 means the next
 * Scene's first unit is centered. Outside a boundary handoff, the control is
 * fully retracted.
 */
export function getSceneBoundaryState(viewport, flowElement, sceneBoundaries = []) {
  if (!viewport || !flowElement || sceneBoundaries.length === 0) return null

  const viewportRect = viewport.getBoundingClientRect()
  const centerY = viewportRect.top + viewport.clientHeight / 2
  let active = null
  let upcoming = null

  sceneBoundaries.forEach(boundary => {
      const from = flowElement.children[boundary.fromIndex]
      const to = flowElement.children[boundary.toIndex]
    if (!from || !to) return

    const centerOf = element => {
      const rect = element.getBoundingClientRect()
      return rect.top + rect.height / 2
    }
    const fromCenter = centerOf(from)
    const toCenter = centerOf(to)
    const span = fromCenter - toCenter
    if (Math.abs(span) < 1) return

    const rawProgress = (fromCenter - centerY) / span
    if (rawProgress > 1.02) return

    if (rawProgress < -0.02) {
      const distanceToBoundary = Math.abs(rawProgress)
      if (!upcoming || distanceToBoundary < upcoming.distanceToBoundary) {
        upcoming = {
          ...boundary,
          progress: 0,
          active: false,
          distanceToBoundary,
        }
      }
      return
    }

    const progress = clamp(rawProgress)
    const distanceToBoundaryEdge = Math.min(progress, 1 - progress)
    if (!active || distanceToBoundaryEdge < active.distanceToBoundaryEdge) {
      active = {
        ...boundary,
        progress,
        active: true,
        distanceToBoundaryEdge,
      }
    }
  })

  return active ?? upcoming
}

export function getSceneBoundaryProgress(viewport, flowElement, sceneBoundaries = []) {
  const state = getSceneBoundaryState(viewport, flowElement, sceneBoundaries)
  return state?.active ? state.progress : 1
}
