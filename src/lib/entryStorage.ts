import type { EntryStorageState } from "../types/entry"

const KEY = "newtone:entry"

export function readEntryStorage(): EntryStorageState {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as EntryStorageState) : {}
  } catch {
    return {}
  }
}

export function writeEntryStorage(patch: Partial<EntryStorageState>): EntryStorageState {
  const prev = readEntryStorage()
  const next: EntryStorageState = { ...prev, ...patch }
  window.localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function hasAnyTrace(state: EntryStorageState): boolean {
  return (
    !!state.preferences ||
    !!state.entryChoice ||
    !!(state.worldProgress && Object.keys(state.worldProgress).length > 0)
  )
}
