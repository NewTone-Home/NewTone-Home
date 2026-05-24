import type { AssetRef, LocalizedString, Publishable, SoftDeletable, Taggable, Timestamped } from "./common"

export type Novel = {
  id: string             // slug，例如 "newtone-1"
  title: LocalizedString
  author: string         // 单作者就用字符串，多作者再升级
  tagline?: LocalizedString
  coverAsset?: AssetRef
} & Timestamped & SoftDeletable & Publishable & Taggable
