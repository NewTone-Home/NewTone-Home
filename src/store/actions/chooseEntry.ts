import { readStorage, writeStorage } from "../../lib/storage"
import { FEATURED_WORLD_ID } from "../../config/featured"
import type {
  EntryChoice,
  EntryDestination,
  EntryStorageState,
} from "../../types"
import type { Setter } from "../types"

// 首次访问入口选择：从头开始 / 我已来过
// 持久化：entryChoice + 对应的 deepestLayer/lastWorldId（关键！否则刷新会掉到兜底）
// + 立即跳到对应目的地
export function createChooseFirstEntryAction(set: Setter) {
  return (choice: EntryChoice) => {
    const destination: EntryDestination =
      choice === "linear"
        ? { kind: "world_hall", worldId: FEATURED_WORLD_ID }
        : { kind: "multiverse" }

    // 一次性持久化：选择 + 深层进度
    const patch: Partial<EntryStorageState> = { entryChoice: choice }
    if (destination.kind === "world_hall") {
      patch.deepestLayer = "world_hall"
      patch.lastWorldId = destination.worldId
    } else if (destination.kind === "multiverse") {
      patch.deepestLayer = "multiverse"
    }

    const current = readStorage()
    writeStorage({ ...current, ...patch })

    set({ destination })
  }
}
