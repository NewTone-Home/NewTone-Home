import type { EntryDestination, EntryStorageState } from "../../types"
import { FEATURED_WORLD_ID } from "../../config/featured"

// 老用户该跳到哪一屏（已知非首次访问）
// 规则：跳到上次到达的最深层
// - 到过多元宇宙 → 回多元宇宙
// - 到过某世界门厅 → 回那个门厅
// - 兜底 → 多元宇宙（最安全的"我已来过"目的地）
export function decideReturningDestination(state: EntryStorageState): EntryDestination {
  if (state.deepestLayer === "multiverse") {
    return { kind: "multiverse" }
  }

  if (state.deepestLayer === "world_hall" && state.lastWorldId) {
    return { kind: "world_hall", worldId: state.lastWorldId }
  }

  if (state.deepestLayer === "chapter" && state.lastChapterId) {
    return {
      kind: "world_hall",
      worldId: state.lastWorldId ?? FEATURED_WORLD_ID,
    }
  }

  return { kind: "multiverse" }
}
