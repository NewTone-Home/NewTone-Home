import { useMemo } from "react"
import { defaultAdapter } from "../../../content"
import type { LocalizedString } from "../../../types"
import type { WorldEntry, WorldHallData } from "../types"

type EntryConfig = {
	matchName: string
	sealChar: string
	label: LocalizedString
}

// W1「初墨」入口映射
const W1_ENTRIES: EntryConfig[] = [
	{
		matchName: "姫修杰",
		sealChar: "札",
		label: { zh: "表 · 中枢院", en: "Outer · Central Court" },
	},
	{
		matchName: "孙若雨",
		sealChar: "筮",
		label: { zh: "里 · 民间占卜", en: "Inner · Folk Divination" },
	},
]

function getNameZh(name: unknown): string {
	if (typeof name === "string") return name
	if (name && typeof name === "object" && "zh" in name) {
		return (name as { zh: string }).zh
	}
	return ""
}

export function useWorldHallData(worldId: string): WorldHallData | null {
	return useMemo(() => {
		const world = defaultAdapter.getWorldById(worldId)
		if (!world) return null
		const characters = defaultAdapter.getCharactersByNovelId(world.novelId)
		const arcs = defaultAdapter
			.getArcsByWorldId(world.id)
			.slice()
			.sort((a, b) => a.order - b.order)
		const chapters = arcs
			.flatMap((arc) => defaultAdapter.getChaptersByArcId(arc.id))
			.sort((a, b) => a.order - b.order)
		const entries: WorldEntry[] = []
		for (let i = 0; i < W1_ENTRIES.length; i++) {
			const cfg = W1_ENTRIES[i]
			// 名字精准匹配优先,index 兜底防御
			let character = characters.find(
				(c) => getNameZh(c.name) === cfg.matchName,
			)
			if (!character) character = characters[i]
			if (!character) continue
			entries.push({
				character,
				sealChar: cfg.sealChar,
				label: cfg.label,
			})
		}
		return {
			worldName: world.name,
			worldTagline: world.tagline,
			entries,
			chapters,
		}
	}, [worldId])
}
