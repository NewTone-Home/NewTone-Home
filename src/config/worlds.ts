// W_主推 参数化配置（Canon §14.3）
// 钉：禁止硬编码 W1。"主推世界"通过这里配置。

export const FEATURED_WORLD_ID = "W1"

export const WORLDS = {
  W1: {
    id: "W1",
    name: "初墨",
    tagline: "中枢院 × 民间占卜",
  },
} as const
