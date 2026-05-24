import { create } from "zustand"
import { createInitAction } from "./actions/init"
import { createChooseFirstEntryAction } from "./actions/chooseEntry"
import { createGoToAction } from "./actions/goTo"
import { createResetAction } from "./actions/reset"
import type { EntryStore } from "./types"

// 入口状态 store —— 薄壳，所有逻辑委托给 actions/
// 这个文件以后永远不应该超过 20 行
export const useEntryStore = create<EntryStore>((set) => ({
  destination: null,
  init: createInitAction(set),
  chooseFirstEntry: createChooseFirstEntryAction(set),
  goTo: createGoToAction(set),
  resetStorage: createResetAction(),
}))
