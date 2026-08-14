export function recordRuntimeAudit(event, payload = {}) {
  if (typeof window === 'undefined') return
  const audit = window.NT_AUDIT || (window.NT_AUDIT = [])
  audit.push({ event, time: Math.round(window.performance?.now?.() || 0), ...payload })
  if (audit.length > 400) audit.splice(0, audit.length - 400)
}
