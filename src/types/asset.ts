import type { LocalizedString, SoftDeletable, Taggable, Timestamped } from "./common"

export type AssetType = "image" | "audio" | "video" | "document"

export type Asset = {
  id: string
  type: AssetType
  url: string                      // Cloudinary / Vercel Blob / 本地路径
  alt?: LocalizedString            // 无障碍必备
  caption?: LocalizedString
  mimeType?: string
  width?: number                   // 图片/视频宽度
  height?: number
  durationSec?: number             // 音频/视频时长
  bytes?: number
  usedBy?: string[]                // 反查："这资源在哪用过"
} & Timestamped & SoftDeletable & Taggable
