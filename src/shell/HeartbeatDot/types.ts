import type { EntryDestination } from "../../types/destination"

export type HeartbeatVariant = "ink_bloom" | "deep_space"

/**
 * Hover 展开四态状态机（Canon §13.3）
 * - breathing: 默认呼吸态（双层差异）
 * - igniting: 进入热区 80ms 后,点燃 120ms（scale↑ opacity↑）
 * - bloomed: 图标完全展开,心跳点消失（钉 2）
 * - collapsing: 鼠标离开 + 300ms 宽容期后,反向播放 320ms,回到 breathing
 */
export type HoverPhase = "breathing" | "igniting" | "bloomed" | "collapsing"

export type VariantDotProps = {
	phase: HoverPhase
}
