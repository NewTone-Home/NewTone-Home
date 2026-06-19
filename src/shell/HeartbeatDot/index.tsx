import { useEntryStore } from "../../store/useEntryStore"
import { useHeartbeatVariant } from "./useHeartbeatVariant"
import { useHoverExpand } from "./useHoverExpand"
import { HitArea } from "./shared/HitArea"
import { IconCluster } from "./expand/IconCluster"
import { InkBloomDot } from "./variants/InkBloomDot"
import { DeepSpaceDot } from "./variants/DeepSpaceDot"

/**
 * 心跳点总调度（Canon §13）
 * - 钉 10: 画风跟随当前层级所属世界（useHeartbeatVariant 决定）
 * - 钉 11: 过场版 Logo 屏可见但不可交互（destination.kind === transient_logo）
 * - 钉 12: 全应用常驻（destination 非 null 即渲染）
 */
export function HeartbeatDot() {
	const destination = useEntryStore((s) => s.destination)
	const variant = useHeartbeatVariant(destination)

	// 钉 11: 过场版不可交互 / destination 还没解析也不可交互
	const isInteractive =
		destination !== null && destination.kind !== "transient_logo"

	const { phase, onMouseEnter, onMouseLeave, onClick } =
		useHoverExpand(!isInteractive)

	if (destination === null) return null

	return (
		<HitArea
			interactive={isInteractive}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onClick={onClick}
		>
			{variant === "deep_space" ? (
				<DeepSpaceDot phase={phase} />
			) : (
				<InkBloomDot phase={phase} />
			)}
			<IconCluster phase={phase} />
		</HitArea>
	)
}
