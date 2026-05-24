import { clearStorage } from "../../lib/storage"

// 清空 localStorage
// 用途：DevReset 按钮 / 未来"撤销我已来过"
// 注意：调用方负责 reload 页面以重新计算 destination
export function createResetAction() {
  return () => {
    clearStorage()
  }
}
