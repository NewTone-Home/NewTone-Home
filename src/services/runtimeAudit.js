const MAX_AUDIT_EVENTS = 800

function getAuditBuffer() {
  if (typeof window === 'undefined') return null

  if (!Array.isArray(window.NT_AUDIT)) window.NT_AUDIT = []
  return window.NT_AUDIT
}

export function recordRuntimeAudit(event, fields = {}) {
  const buffer = getAuditBuffer()
  if (!buffer) return null

  const item = {
    sequence: buffer.length + 1,
    atMs: Math.round(window.performance?.now?.() ?? 0),
    event,
    ...fields,
  }

  buffer.push(item)
  if (buffer.length > MAX_AUDIT_EVENTS) buffer.splice(0, buffer.length - MAX_AUDIT_EVENTS)
  return item
}

export function clearRuntimeAudit() {
  const buffer = getAuditBuffer()
  if (buffer) buffer.length = 0
}
