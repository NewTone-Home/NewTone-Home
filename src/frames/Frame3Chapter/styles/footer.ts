import type { CSSProperties } from "react"

export const FOOTER_OUTER: CSSProperties = {
	textAlign: "center",
	marginTop: "20vh",
	opacity: 0.85,
}

export const FOOTER_ROMAN: CSSProperties = {
	fontSize: 12,
	opacity: 0.4,
	letterSpacing: "0.3em",
	marginBottom: 12,
}

export const FOOTER_HINT: CSSProperties = {
	fontSize: 12,
	opacity: 0.3,
}

export const FOOTER_ACTIONS: CSSProperties = {
	display: "flex",
	justifyContent: "center",
	gap: 18,
	marginTop: 24,
}

export const FOOTER_ACTION_BUTTON: CSSProperties = {
	border: "none",
	background: "transparent",
	color: "var(--color-muted)",
	fontFamily: "inherit",
	fontSize: 12,
	cursor: "pointer",
	opacity: 0.5,
	padding: "8px 10px",
}
