import { useLanguageStore } from "../store/useLanguageStore"
import type { LocalizedString } from "../types"

// LocalizedString → 当前语言文本，订阅 useLanguageStore 自动响应切换
// 跟 v0.3.1 useT() 同套思路（订阅 + 回落 zh）
export function useLocalized(): (s: LocalizedString) => string {
	const lang = useLanguageStore((s) => s.lang)
	return (s: LocalizedString) => s[lang] ?? s.zh
}
