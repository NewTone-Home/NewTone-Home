import type { EntryStorageState } from "../../types"
import { CURRENT_SCHEMA_VERSION } from "../../types"

// 空状态默认值 —— 首次访问 / 数据损坏 / 未来版本回落 都用这个
export function getDefaultStorageState(): EntryStorageState {
  return {
    version: CURRENT_SCHEMA_VERSION,
  }
}
