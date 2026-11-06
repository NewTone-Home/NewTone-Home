// Presentation only. Opening/collapsing the menu never prepares a save operation.
export function saveEntryMenuMode(entry, expandedSnapshot) {
  if (entry.phase === 'overwrite-confirm') return 'confirm'
  if (entry.phase === 'choice-ready') return expandedSnapshot !== null && expandedSnapshot === entry.inspection?.snapshotToken ? 'choices' : 'primary'
  if (entry.phase === 'legacy-ready') return expandedSnapshot !== null && expandedSnapshot === entry.inspection?.snapshotToken ? 'legacy' : 'primary'
  if (entry.phase === 'start-ready') return 'primary'
  return 'status'
}

export function beginSaveEntry(entry, expand, onAction) {
  if (entry.phase === 'start-ready' && entry.inspection?.allowedActions?.includes('create')) return onAction('create')
  if (['choice-ready', 'legacy-ready'].includes(entry.phase)) return expand(entry.inspection.snapshotToken)
}
