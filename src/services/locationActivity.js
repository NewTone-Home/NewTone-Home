// One ledger for every real runtime location. Uses the shared real-time activity
// totals, never accelerated game time, clicks, labels, or manually listed rooms.
export function createLocationActivity({ id = () => crypto.randomUUID(), onEnter = () => {}, onLeave = () => {} } = {}) {
  let current = null
  const read = totals => current ? {
    sceneId: current.sceneId, roomId: current.roomId, visitId: current.visitId,
    sceneForegroundMs: Math.max(0, totals.foregroundMs - current.base.foregroundMs),
    sceneEngagedMs: Math.max(0, totals.engagedMs - current.base.engagedMs),
  } : null
  return {
    read,
    move(sceneId, roomId, totals) {
      if (current?.sceneId === sceneId && current?.roomId === roomId) return false
      if (current) onLeave(read(totals), totals, 'location-change')
      current = { sceneId, roomId, visitId: id(), base: { ...totals } }
      onEnter(read(totals), totals)
      return true
    },
    end(totals, reason = 'runtime-stop') {
      if (!current) return false
      onLeave(read(totals), totals, reason);current = null
      return true
    },
  }
}
