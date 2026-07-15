export const READER_INTENTS = Object.freeze({
  FORWARD: 'forward',
  BACKWARD: 'backward',
})

export const WHEEL_INTENT_THRESHOLD = 80
export const TOUCH_INTENT_THRESHOLD = 36
export const INPUT_QUEUE_LIMIT = 2

export function oppositeIntent(intent) {
  return intent === READER_INTENTS.FORWARD
    ? READER_INTENTS.BACKWARD
    : READER_INTENTS.FORWARD
}

export function enqueueReaderIntent(queue, intent, limit = INPUT_QUEUE_LIMIT) {
  const next = [...queue]
  if (next.at(-1) === oppositeIntent(intent)) {
    next.pop()
    return next
  }
  if (next.length < limit) next.push(intent)
  return next
}

export function consumeReaderIntent(queue) {
  if (queue.length === 0) return { intent: null, queue }
  return { intent: queue[0], queue: queue.slice(1) }
}

export function accumulateWheelIntent(accumulated, deltaY) {
  if (!Number.isFinite(deltaY)) return { accumulated, intent: null }
  const next = accumulated + deltaY
  if (Math.abs(next) < WHEEL_INTENT_THRESHOLD) {
    return { accumulated: next, intent: null }
  }
  return {
    accumulated: 0,
    intent: next > 0 ? READER_INTENTS.FORWARD : READER_INTENTS.BACKWARD,
  }
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
