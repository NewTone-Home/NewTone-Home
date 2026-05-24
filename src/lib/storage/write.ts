import { STORAGE_KEY } from "../../types"
import type { EntryStorageState } from "../../types"

// 写入入口状态到 localStorage
// 失败时静默警告（隐私模式 / 配额满 / SSR）
export function writeStorage(state: EntryStorageState): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn("[storage] write failed:", err)
  }
}
