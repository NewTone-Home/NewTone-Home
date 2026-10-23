type AnimationFrameScheduler = Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>

/**
 * Coalesces late first measurements and caps retries per target. Retries are
 * requested by DOM mutations, never by a polling animation-frame loop.
 */
export function createSceneFocusFrameDeferredMeasureScheduler(
  win: AnimationFrameScheduler,
  maxRetries = 2,
) {
  const retries = new Map<string, number>()
  const frames = new Map<string, number>()
  const completed = new Set<string>()
  let disposed = false

  return {
    request(group: string, measure: () => boolean) {
      if (disposed || completed.has(group) || frames.has(group) || (retries.get(group) ?? 0) >= maxRetries) return
      const frame = win.requestAnimationFrame(() => {
        frames.delete(group)
        if (disposed) return
        retries.set(group, (retries.get(group) ?? 0) + 1)
        if (measure()) {
          retries.delete(group)
          completed.add(group)
        }
      })
      frames.set(group, frame)
    },
    dispose() {
      disposed = true
      frames.forEach(frame => win.cancelAnimationFrame(frame))
      frames.clear()
      retries.clear()
      completed.clear()
    },
  }
}
