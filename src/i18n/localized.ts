import { getCurrentUILang } from "./currentLang"
import type { LocalizedString } from "../types"

// LocalizedString → 当前语言字符串
// 缺失目标语言时自动回落中文
export function localized(s: LocalizedString): string {
  const lang = getCurrentUILang()
  return s[lang] ?? s.zh
}
