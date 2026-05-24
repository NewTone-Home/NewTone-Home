import type { EntryChoice, EntryDestination } from "../types"

export type EntryStoreState = {
  destination: EntryDestination | null
}

export type EntryStoreActions = {
  init: () => void
  chooseFirstEntry: (choice: EntryChoice) => void
  goTo: (destination: EntryDestination) => void
  resetStorage: () => void
}

export type EntryStore = EntryStoreState & EntryStoreActions

// zustand set 函数类型
export type Setter = (partial: Partial<EntryStoreState>) => void
