import type { AssetRef, LocalizedString, SoftDeletable, Taggable, Timestamped } from "./common"

export type Character = {
  id: string
  novelId: string                  // 主属（Phase 1）
  novelIds?: string[]              // Phase 2 跨小说预留
  name: LocalizedString
  guaSymbol?: string               // ☰☱☲☳☴☵☶☷
  bio?: LocalizedString
  portraitAsset?: AssetRef
} & Timestamped & SoftDeletable & Taggable
