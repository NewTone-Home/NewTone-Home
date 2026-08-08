export const HOLD_PROGRESS_TIMINGS = Object.freeze({
  DRAW_MS: 1500,
  RETRACT_MS: 420,
  FLASH_MS: 560,
})

let holdProgressPaused = false

export function setHoldProgressPaused(paused) {
  holdProgressPaused = Boolean(paused)
}

export function stepHoldProgress(current, target, deltaMs, timings = HOLD_PROGRESS_TIMINGS) {
  if (holdProgressPaused && target > current) return current

  const duration = target > current ? timings.DRAW_MS : timings.RETRACT_MS
  const distance = Math.max(0, deltaMs) / duration
  return target > current
    ? Math.min(target, current + distance)
    : Math.max(target, current - distance)
}
