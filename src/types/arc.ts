import type { AssetRef, LocalizedString, Publishable, SoftDeletable, Taggable, Timestamped } from "./common"

export type Arc = {
  id: string
  worldId: string
  order: number
  title: LocalizedString
  description?: LocalizedString
  coverAsset?: AssetRef
} & Timestamped & SoftDeletable & Publishable & Taggable
