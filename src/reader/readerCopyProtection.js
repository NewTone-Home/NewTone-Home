const BLOCKED_READER_SHORTCUTS = new Set(['a', 'c', 'x'])

export function preventReaderTransfer(event) {
  event.preventDefault()
  return true
}

export function preventReaderShortcut(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false
  if (!BLOCKED_READER_SHORTCUTS.has(String(event.key).toLowerCase())) return false
  event.preventDefault()
  return true
}
