import type { UILang } from "./types"

// 当前 UI 语言
// Phase 1：固定 zh
// Phase 2：从 zustand store 读 / URL 查询参数 / 浏览器语言协商
export function getCurrentUILang(): UILang {
  return "zh"
}
