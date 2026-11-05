type AnimationFrameWindow = Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>

/** Schedule one post-transition measurement, invalidating stale endpoint work. */
export function createEndpointMeasurementScheduler(
  win: AnimationFrameWindow,
  readProgress: () => number,
  measure: () => void,
) {
  let generation = 0
  let frameIds: number[] = []

  const cancelPending = () => {
    frameIds.forEach((id) => win.cancelAnimationFrame(id))
    frameIds = []
  }

  return {
    progressChanged() {
      generation += 1
      cancelPending()
      const scheduledGeneration = generation
      const progress = readProgress()
      if (progress !== 0 && progress !== 1) return

      const firstFrame = win.requestAnimationFrame(() => {
        frameIds = frameIds.filter((id) => id !== firstFrame)
        if (scheduledGeneration !== generation || readProgress() !== progress) return
        const secondFrame = win.requestAnimationFrame(() => {
          frameIds = frameIds.filter((id) => id !== secondFrame)
          if (scheduledGeneration !== generation || readProgress() !== progress) return
          measure()
        })
        frameIds.push(secondFrame)
      })
      frameIds.push(firstFrame)
    },
    dispose() {
      generation += 1
      cancelPending()
    },
  }
}
