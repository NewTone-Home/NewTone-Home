import { STORAGE_KEY } from "../../types"

// 清空入口状态
// 用途：DevResetButton / "撤销我已来过" / 用户主动重置
export function clearStorage(): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn("[storage] clear failed:", err)
  }
}
