import { readStorage, writeStorage } from "../../lib/storage"
import type { EntryDestination, EntryStorageState } from "../../types"
import type { Setter } from "../types"

// 跳到指定屏 + 同步持久化"最深层"进度
export function createGoToAction(set: Setter) {
  return (destination: EntryDestination) => {
    set({ destination })

    const current = readStorage()
    const patch: Partial<EntryStorageState> = {}

    if (destination.kind === "world_hall") {
      patch.deepestLayer = "world_hall"
      patch.lastWorldId = destination.worldId
    } else if (destination.kind === "multiverse") {
      patch.deepestLayer = "multiverse"
    }

    writeStorage({ ...current, ...patch })
  }
}
