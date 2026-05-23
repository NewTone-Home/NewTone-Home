import { create } from "zustand"
import {
  readEntryStorage,
  writeEntryStorage,
} from "../lib/entryStorage"
import {
  computeEntryDestination,
  destinationForFirstChoice,
} from "../lib/entryStateMachine"
import type { EntryChoice, EntryDestination } from "../types/entry"

interface EntryStore {
  destination: EntryDestination
  init: () => void
  chooseFirstEntry: (choice: EntryChoice) => void
  goTo: (dest: EntryDestination) => void
  resetStorage: () => void
}

export const useEntryStore = create<EntryStore>((set) => ({
  destination: { kind: "logo_full" },

  init: () => {
    const state = readEntryStorage()
    const dest = computeEntryDestination(state)
    set({ destination: dest })
  },

  chooseFirstEntry: (choice) => {
    writeEntryStorage({ entryChoice: choice })
    const dest = destinationForFirstChoice(choice)
    set({ destination: dest })
  },

  goTo: (dest) => set({ destination: dest }),

  resetStorage: () => {
    localStorage.clear()
    set({ destination: { kind: "logo_full" } })
  },
}))
