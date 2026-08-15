const BLOCKED_PUBLIC_SHORTCUTS = new Set(['a', 'c', 'v', 'x'])

function isEditableTarget(target) {
  return Boolean(
    target
    && typeof target.closest === 'function'
    && target.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

export function preventPublicTransfer(event) {
  if (isEditableTarget(event.target)) return false
  event.preventDefault()
  return true
}

export function preventPublicShortcut(event) {
  if (isEditableTarget(event.target)) return false
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false
  if (!BLOCKED_PUBLIC_SHORTCUTS.has(String(event.key).toLowerCase())) return false
  event.preventDefault()
  return true
}
