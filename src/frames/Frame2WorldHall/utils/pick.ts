import type { LocalizedString } from "../../../types"

// LocalizedString → 当前语言文本，zh 兜底
export function pickText(
	value: LocalizedString | undefined,
	lang: "zh" | "en",
): string {
	if (!value) return ""
	return value[lang] || value.zh || ""
}
