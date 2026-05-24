import zhStrings from "./dictionaries/zh.json"
import { getCurrentUILang } from "./currentLang"
import type { UILang, UIStrings } from "./types"

const DICTIONARIES: Record<UILang, UIStrings> = {
  zh: zhStrings as UIStrings,
  en: zhStrings as UIStrings,  // 暂用中文兜底，未来加 en.json
}

// UI 文案访问器
// 用法：t().entry.anyKeyHint —— 全类型安全，IDE 自动补全
export function t(): UIStrings {
  return DICTIONARIES[getCurrentUILang()]
}
