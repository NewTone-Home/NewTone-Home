import { FEATURED_WORLD_ID } from "../../config/featured"
import { getWorldById } from "./worlds"
import type { World } from "../../types"

// 主推世界（"从头开始"用户落地的目标）
// 数据来自 config，将来可改为内容自带 isFeatured 标记
export function getFeaturedWorld(): World | undefined {
  return getWorldById(FEATURED_WORLD_ID)
}
