import type { CSSProperties } from "react"

export const buttonsRowStyle: CSSProperties = {
	display: "flex",
	gap: 18,
	flexWrap: "wrap",
	justifyContent: "center",
}

export const buttonStyle: CSSProperties = {
	minWidth: 210,
	background: "transparent",
	border: "1px solid rgba(225, 238, 241, 0.72)",
	padding: "13px 20px",
	fontFamily: "var(--font-serif-sc)",
	color: "#eef8f8",
	cursor: "pointer",
	letterSpacing: 0,
	transition: "all 0.2s ease",
	display: "grid",
	gap: 5,
	textAlign: "left",
}

export const buttonLabelStyle: CSSProperties = {
	fontSize: "var(--font-size-md)",
	fontWeight: 300,
	lineHeight: 1.25,
}

export const buttonHintStyle: CSSProperties = {
	fontSize: 11,
	fontWeight: 300,
	lineHeight: 1.35,
	opacity: 0.68,
}
