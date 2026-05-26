import type { CSSProperties } from "react"

// 跟随主题色（light / dark / sepia 自动切换）
// W1 专属暖纸色调放到 v0.6 主题工程统一做,不在 frame 层硬编码
export const CONTAINER_STYLE: CSSProperties = {
	position: "fixed",
	inset: 0,
	zIndex: 0, // 明确放底层,保证 HeartbeatDot / IconCluster 在上面能点
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	background: "var(--color-bg)",
	color: "var(--color-text)",
	fontFamily: "inherit",
}
