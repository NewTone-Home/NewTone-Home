import type { EntryStorageState } from "../../types"

// 是否首次访问 = 从未做过任何入口选择
export function isFirstVisit(state: EntryStorageState): boolean {
  return !state.entryChoice
}
