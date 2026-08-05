export const ADMIN_ACCESS_SEQUENCE = '9989'
export const ADMIN_SEQUENCE_TIMEOUT_MS = 1200

const TEXT_INPUT_TYPES = new Set(['', 'date', 'datetime-local', 'email', 'month', 'number', 'password', 'search', 'tel', 'text', 'time', 'url', 'week'])

export function createAdminSequenceState() {
  return { buffer: '', lastInputAt: 0 }
}

export function advanceAdminSequence(state, key, now, timeoutMs = ADMIN_SEQUENCE_TIMEOUT_MS) {
  const current = state ?? createAdminSequenceState()
  const elapsed = current.lastInputAt ? now - current.lastInputAt : 0
  const buffer = elapsed > timeoutMs ? '' : current.buffer
  if (!/^\d$/.test(key)) return { state: createAdminSequenceState(), matched: false }
  const next = `${buffer}${key}`
  if (!ADMIN_ACCESS_SEQUENCE.startsWith(next)) return { state: createAdminSequenceState(), matched: false }
  if (next === ADMIN_ACCESS_SEQUENCE) return { state: createAdminSequenceState(), matched: true }
  return { state: { buffer: next, lastInputAt: now }, matched: false }
}

export function isTextEditingTarget(target) {
  if (!target || typeof target.closest !== 'function') return false
  if (target.closest('textarea, [role="textbox"], [contenteditable]:not([contenteditable="false"])')) return true
  const input = target.closest('input')
  if (!input) return false
  return TEXT_INPUT_TYPES.has((input.getAttribute('type') ?? '').toLowerCase())
}
