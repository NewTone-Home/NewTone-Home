import type { CSSProperties } from "react"

export const CHAPTER_LIST_WRAP_STYLE: CSSProperties = {
	position: "absolute",
	left: "clamp(24px, 7vw, 96px)",
	bottom: "clamp(112px, 18vh, 172px)",
	display: "flex",
	flexDirection: "column",
	gap: 10,
	minWidth: 220,
	maxWidth: 320,
	color: "var(--color-text)",
}

export const CHAPTER_LIST_LABEL_STYLE: CSSProperties = {
	margin: 0,
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 1.4,
	textTransform: "uppercase",
	opacity: 0.38,
}

export const CHAPTER_LIST_STYLE: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
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
	border: 0,
	background: "transparent",
	color: "inherit",
	fontFamily: "inherit",
	textAlign: "left",
	cursor: "pointer",
	padding: "6px 0",
	opacity: 0.5,
}

export const CHAPTER_ORDER_STYLE: CSSProperties = {
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 1,
	opacity: 0.68,
}

export const CHAPTER_TITLE_STYLE: CSSProperties = {
	minWidth: 0,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	fontSize: 13,
	fontWeight: 300,
	letterSpacing: 0.8,
}
