export const ENTRY_MENU_EXIT_MS = 220

export function isCurrentEntryMenuMotion(record, entry) {
  return !!record && entry.epoch === record.epoch && entry.inspection?.snapshotToken === record.snapshot
}

export function takeEntryMenuIntent(record, value, loadingLabel, entry) {
  if (!record || record.consumed || value !== loadingLabel || !isCurrentEntryMenuMotion(record, entry)) return null
  record.consumed = true
  return record.intent
}
