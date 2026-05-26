import { useCallback } from "react"
import { CONTAINER_STYLE } from "./styles/container"
import { WorldTitle } from "./parts/WorldTitle"
import { CharacterEntries } from "./parts/CharacterEntries"
import { useWorldHallData } from "./hooks/useWorldHallData"
import type { Frame2WorldHallProps } from "./types"

/**
 * Frame 2 · 世界门厅（Ambient UI / K 方案）
 * - 字符默认 8% 灰水印,几乎隐形(钉合 NewTone "UI 藏起来")
 * - hover 接近 → 渐显形 + 副信息 stagger 浮出
 * - 点击 → onSelect(characterId)（v0.5 接 Frame 3 章节阅读）
 * - 心跳点由 AppShell 渲染,本 frame 不重复
 */
export function Frame2WorldHall({ worldId }: Frame2WorldHallProps) {
	const data = useWorldHallData(worldId)

	const handleSelect = useCallback((characterId: string) => {
		// TODO v0.5: useEntryStore.goTo({ kind: "chapter", characterId, chapterId: ... })
		console.log("[world_hall] selected character:", characterId)
	}, [])

	if (!data) return null

	return (
		<div style={CONTAINER_STYLE}>
			<WorldTitle name={data.worldName} tagline={data.worldTagline} />
			<CharacterEntries
				entries={data.entries}
				onSelect={handleSelect}
			/>
		</div>
	)
}
