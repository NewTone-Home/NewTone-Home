// localStorage 三层数据模型（Canon §14.1）

export type EntryChoice = "linear" | "free_explore"

export type DeepestLayer = "multiverse" | "world_hall" | "chapter"

export interface Preferences {
  language?: "zh" | "en" | "ja"
  theme?: "light" | "dark"
  fontSize?: "small" | "medium" | "large"
}

export interface WorldProgress {
  worldId: string
  deepestLayer: DeepestLayer
  unlockedAll: boolean
}

export interface EntryStorageState {
  preferences?: Preferences
  entryChoice?: EntryChoice
  worldProgress?: Record<string, WorldProgress>
  lastVisitedWorld?: string
}

export type EntryDestination =
  | { kind: "logo_full" }
  | { kind: "logo_transient"; next: EntryDestination }
  | { kind: "world_hall"; worldId: string }
  | { kind: "multiverse" }
