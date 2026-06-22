import type { CSSProperties } from "react"

export const CHAPTER_LIST_WRAP_STYLE: CSSProperties = {
	position: "absolute",
	left: "clamp(24px, 7vw, 96px)",
	bottom: "clamp(84px, calc(180px - 9vw), 140px)",
	display: "flex",
	flexDirection: "column",
	gap: 8,
	width: "min(320px, calc(100vw - 48px))",
	color: "var(--color-text)",
	borderLeft: "1px solid color-mix(in srgb, var(--color-text) 18%, transparent)",
	paddingLeft: 14,
}

export const CHAPTER_LIST_LABEL_STYLE: CSSProperties = {
	margin: 0,
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 0,
	textTransform: "uppercase",
	opacity: 0.46,
}

export const CHAPTER_LIST_STYLE: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 2,
	margin: 0,
	padding: 0,
	listStyle: "none",
}

export const CHAPTER_BUTTON_STYLE: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "36px minmax(0, 1fr)",
	alignItems: "center",
	gap: 10,
	width: "100%",
	border: "1px solid transparent",
	borderRadius: 4,
	background: "color-mix(in srgb, var(--color-bg) 88%, transparent)",
	color: "inherit",
	fontFamily: "inherit",
	textAlign: "left",
	cursor: "pointer",
	padding: "7px 8px",
	opacity: 0.58,
}

export const CHAPTER_ORDER_STYLE: CSSProperties = {
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 0,
	opacity: 0.74,
}

export const CHAPTER_TITLE_STYLE: CSSProperties = {
	minWidth: 0,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	fontSize: 13,
	fontWeight: 300,
	letterSpacing: 0,
}
