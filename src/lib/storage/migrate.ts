import { CURRENT_SCHEMA_VERSION } from "../../types"
import type { EntryStorageState } from "../../types"
import { getDefaultStorageState } from "./defaults"

// Schema 迁移调度
// - 当前版本 → 直通
// - 旧版本 → 链式升级（Phase 1 暂无升级链，直接回落默认）
// - 未来版本 → 不识别，回落默认（避免低版本读不懂高版本数据导致崩溃）
export function migrate(raw: unknown): EntryStorageState {
  if (!isObject(raw)) return getDefaultStorageState()

  const version = typeof raw.version === "number" ? raw.version : 0

  if (version === CURRENT_SCHEMA_VERSION) {
    return raw as EntryStorageState
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    console.warn(`[storage] future schema v${version}, falling back to defaults`)
    return getDefaultStorageState()
  }

  // 未来在这里链式注册迁移函数：
  // if (version === 1) raw = migrateV1ToV2(raw)
  // if (version === 2) raw = migrateV2ToV3(raw)

  return getDefaultStorageState()
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}
