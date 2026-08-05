export const READER_INTENTS = Object.freeze({
  FORWARD: 'forward',
  BACKWARD: 'backward',
})

export const WHEEL_INTENT_THRESHOLD = 80
export const TOUCH_INTENT_THRESHOLD = 36

export function normalizeWheelDelta(deltaY, deltaMode = 0, viewportHeight = 800) {
  if (!Number.isFinite(deltaY)) return 0
  if (deltaMode === 1) return deltaY * 16
  if (deltaMode === 2) return deltaY * Math.max(1, viewportHeight)
  return deltaY
}

export function accumulateWheelSteps(accumulated, deltaY, threshold = WHEEL_INTENT_THRESHOLD) {
  if (!Number.isFinite(deltaY)) return { accumulated, steps: 0 }
  const safeThreshold = Number.isFinite(threshold) && threshold > 0 ? threshold : WHEEL_INTENT_THRESHOLD
  const next = accumulated + deltaY
  const rawSteps = Math.trunc(next / safeThreshold)
  const steps = rawSteps === 0 ? 0 : Math.sign(rawSteps)
  return {
    accumulated: steps === 0 ? next : 0,
    steps,
  }
}

export function intentToReaderSteps(intent) {
  if (intent === READER_INTENTS.FORWARD) return 1
  if (intent === READER_INTENTS.BACKWARD) return -1
  return 0
}

export function keyToReaderIntent({ key, shiftKey = false }) {
  if (key === 'ArrowDown' || key === 'PageDown' || (key === ' ' && !shiftKey)) {
    return READER_INTENTS.FORWARD
  }
  if (key === 'ArrowUp' || key === 'PageUp' || (key === ' ' && shiftKey)) {
    return READER_INTENTS.BACKWARD
  }
  return null
}

export function touchToReaderIntent(startY, currentY) {
  if (!Number.isFinite(startY) || !Number.isFinite(currentY)) return null
  const distance = startY - currentY
  if (Math.abs(distance) < TOUCH_INTENT_THRESHOLD) return null
  return distance > 0 ? READER_INTENTS.FORWARD : READER_INTENTS.BACKWARD
}

export function isReaderInputControl(target) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('button, input, select, textarea, a, [contenteditable="true"], [role="menu"]'))
}

export function isNativeReaderScrollTarget(target) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('.reader-beat-stack[data-native-scroll="true"]'))
}
