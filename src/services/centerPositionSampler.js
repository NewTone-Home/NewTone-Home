export const CENTER_POSITION_SAMPLE_INTERVAL_MS = 1000
export const CENTER_POSITION_SAMPLE_DISTANCE = 1.5

export function createCenterPositionSampler({
  now = () => Date.now(),
  onSample = () => {},
  minIntervalMs = CENTER_POSITION_SAMPLE_INTERVAL_MS,
  minDistance = CENTER_POSITION_SAMPLE_DISTANCE,
} = {}) {
  let last = null
  return {
    sample(sceneId, point, { boundary = false } = {}) {
      if (!sceneId || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return false
      const at = now()
      const sceneChanged = last?.sceneId !== sceneId
      const distance = last
        ? Math.hypot(point.x - last.point.x, point.y - last.point.y)
        : Number.POSITIVE_INFINITY
      if (last && !sceneChanged && !boundary
        && (at - last.at < minIntervalMs || distance < minDistance)) return false
      if (last && !sceneChanged && boundary && distance < Number.EPSILON) return false
      last = { sceneId, point: { x: point.x, y: point.y }, at }
      onSample({ sceneId, positionX: point.x, positionY: point.y })
      return true
    },
    reset() { last = null },
    getLast() { return last ? { sceneId: last.sceneId, ...last.point, at: last.at } : null },
  }
}
