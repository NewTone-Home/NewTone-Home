import zhStrings from "./dictionaries/zh.json"
import enStrings from "./dictionaries/en.json"
import { getCurrentUILang } from "./currentLang"
import { useLanguageStore } from "../store/useLanguageStore"
import type { UILang, UIStrings } from "./types"

const DICTIONARIES: Record<UILang, UIStrings> = {
	zh: zhStrings as UIStrings,
	en: enStrings as UIStrings,
}

// UI 文案访问器（非 React 上下文）
// 用法：t().entry.anyKeyHint
export function t(): UIStrings {
	return DICTIONARIES[getCurrentUILang()]
}

// UI 文案访问器（React Hook，订阅 store 触发重渲染）
// 用法：const tr = useT(); tr.entry.anyKeyHint
export function useT(): UIStrings {
	const lang = useLanguageStore((s) => s.lang)
	return DICTIONARIES[lang]
}
