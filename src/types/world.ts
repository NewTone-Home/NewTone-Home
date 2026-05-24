import type { AssetRef, LocalizedString, Publishable, SoftDeletable, Taggable, Timestamped } from "./common"

export type World = {
  id: string                       // slug，例如 "chumo"
  novelId: string                  // 主属（Phase 1）
  sharedWithNovelIds?: string[]    // Phase 2 跨小说预留
  name: LocalizedString
  tagline?: LocalizedString
  description?: LocalizedString
  coverAsset?: AssetRef
} & Timestamped & SoftDeletable & Publishable & Taggable
