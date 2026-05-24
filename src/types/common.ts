// 通用积木：所有内容类型共享的基础块

export type LocalizedString = {
  zh: string
  en?: string
}

export type Timestamped = {
  createdAt: string  // ISO 8601
  updatedAt: string
}

export type SoftDeletable = {
  deletedAt?: string  // undefined = 活跃
}

export type Publishable = {
  publishedAt?: string  // undefined = 草稿
}

export type Taggable = {
  tags?: string[]
}

export type AssetRef = {
  assetId: string
}
