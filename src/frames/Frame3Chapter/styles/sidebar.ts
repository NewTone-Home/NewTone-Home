import type { CSSProperties } from "react"

export const SIDEBAR: CSSProperties = {
	position: "fixed",
	top: 0,
	left: 0,
	bottom: 0,
	width: 60,
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	paddingTop: 32,
	paddingBottom: 32,
	zIndex: 10,
	pointerEvents: "none",
}

export const SIDEBAR_BACK: CSSProperties = {
	background: "none",
	border: "none",
	color: "var(--color-fg)",
	fontSize: 22,
	cursor: "pointer",
	opacity: 0.15,
	transition: "opacity 200ms",
	pointerEvents: "auto",
	padding: 0,
}

export const SIDEBAR_ROMAN: CSSProperties = {
	marginTop: 96,
	fontSize: 14,
	letterSpacing: "0.5em",
	color: "var(--color-fg)",
	opacity: 0.2,
}

export const SIDEBAR_YAO_BOX: CSSProperties = {
	marginTop: "auto",
	marginBottom: "auto",
	display: "flex",
	flexDirection: "column",
	gap: 12,
	alignItems: "center",
}

export const SIDEBAR_BOTTOM_PAD: CSSProperties = {
	marginBottom: 16,
}

export const YAO_LINE_WRAP: CSSProperties = {
	position: "relative",
	width: 24,
	height: 2,
	overflow: "visible",
}
