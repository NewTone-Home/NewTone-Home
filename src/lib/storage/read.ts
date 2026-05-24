import { STORAGE_KEY } from "../../types"
import type { EntryStorageState } from "../../types"
import { getDefaultStorageState } from "./defaults"
import { migrate } from "./migrate"

// 从 localStorage 读取入口状态
// - 不存在 / SSR / 解析失败 → 默认空状态
// - 旧 schema → 自动迁移到最新版本
export function readStorage(): EntryStorageState {
  if (typeof window === "undefined") return getDefaultStorageState()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultStorageState()

    const parsed = JSON.parse(raw) as unknown
    return migrate(parsed)
  } catch (err) {
    console.warn("[storage] read failed, using defaults:", err)
    return getDefaultStorageState()
  }
}
