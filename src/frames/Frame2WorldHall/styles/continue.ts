import type { CSSProperties } from "react"

export const CONTINUE_BUTTON_STYLE: CSSProperties = {
	position: "absolute",
	left: "50%",
	bottom: "clamp(52px, 9vh, 92px)",
	transform: "translateX(-50%)",
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 4,
	border: 0,
	background: "transparent",
	color: "var(--color-text)",
	fontFamily: "inherit",
	cursor: "pointer",
	opacity: 0.48,
	padding: "8px 12px",
}

export const CONTINUE_LABEL_STYLE: CSSProperties = {
	fontSize: 12,
	fontWeight: 300,
	letterSpacing: 1.5,
}

export const CONTINUE_CHAPTER_STYLE: CSSProperties = {
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 1,
	opacity: 0.66,
}
