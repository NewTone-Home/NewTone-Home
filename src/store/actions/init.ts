import { readStorage } from "../../lib/storage"
import { decideDestination } from "../../lib/entryStateMachine"
import type { Setter } from "../types"

// 启动初始化：读取持久状态，决定首屏目的地
export function createInitAction(set: Setter) {
  return () => {
    const state = readStorage()
    set({ destination: decideDestination(state) })
  }
}
