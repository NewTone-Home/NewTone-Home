import type { EntryDestination, EntryStorageState } from "../../types"
import { isFirstVisit } from "./isFirstVisit"
import { decideReturningDestination } from "./decideReturning"

// 主调度：根据存储状态决定该跳到哪一屏
// 纯函数：state in, destination out（无副作用，超好测）
export function decideDestination(state: EntryStorageState): EntryDestination {
  // 首次访问 → 展示完整 logo 屏 + 两按钮入口
  if (isFirstVisit(state)) {
    return { kind: "full_logo" }
  }

  // 老用户 → 闪过 logo，跳到上次最深层
  const next = decideReturningDestination(state)
  return { kind: "transient_logo", next }
}
