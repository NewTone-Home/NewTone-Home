import type { AssetRef, LocalizedString, Publishable, SoftDeletable, Taggable, Timestamped } from "./common"

export type AccessLevel = "public" | "members" | "paid"

export type EventRef = {
  eventId: string
  significance?: "minor" | "major" | "key"
}

export type Chapter = {
  id: string
  arcId: string
  order: number
  title: LocalizedString
  body: LocalizedString            // Markdown 文本
  characterIds?: string[]          // 出场角色
  coverAsset?: AssetRef
  events?: EventRef[]              // 主线事件链钩子（预留）
  accessLevel?: AccessLevel        // 默认 public
} & Timestamped & SoftDeletable & Publishable & Taggable
