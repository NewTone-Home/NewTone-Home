export type EntryChoice = "linear" | "free_explore"
export type DeepestLayer = "multiverse" | "world_hall" | "chapter"

export type ReaderPreferences = {
  fontSize?: "small" | "medium" | "large"
  theme?: "light" | "dark" | "sepia"
  language?: "zh" | "en"
}

export type WorldProgress = {
  worldId: string
}

export type ChapterProgress = {
  chapterId: string
  scrollTop: number
  progress: number
  updatedAt: string
}

export type EntryStorageState = {
  version: number
  entryChoice?: EntryChoice
  worldProgress?: Record<string, WorldProgress>
  chapterProgress?: Record<string, ChapterProgress>
  deepestLayer?: DeepestLayer
  lastWorldId?: string
  lastChapterId?: string
  preferences?: ReaderPreferences
}

export const STORAGE_KEY = "newtone:entry"
export const CURRENT_SCHEMA_VERSION = 1
