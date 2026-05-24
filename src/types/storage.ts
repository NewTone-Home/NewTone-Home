// localStorage 里持久化的状态形状

export type EntryChoice = "linear" | "free_explore"
export type DeepestLayer = "multiverse" | "world_hall" | "chapter"

export type ReaderPreferences = {
  fontSize?: "small" | "medium" | "large"
  theme?: "light" | "dark" | "sepia"
}

export type WorldProgress = {
  worldId: string
  // 未来扩展：到达的 Arc、Chapter 等
}

export type EntryStorageState = {
  version: number                  // schema 版本，当前 = 1
  entryChoice?: EntryChoice
  worldProgress?: Record<string, WorldProgress>
  deepestLayer?: DeepestLayer
  lastWorldId?: string
  lastChapterId?: string           // 阅读进度预留
  preferences?: ReaderPreferences
}

export const STORAGE_KEY = "newtone:entry"
export const CURRENT_SCHEMA_VERSION = 1
