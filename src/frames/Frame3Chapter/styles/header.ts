import type { CSSProperties } from "react"

export const HEADER_OUTER: CSSProperties = {
	textAlign: "center",
	marginBottom: "18vh",
	opacity: 0.85,
}

export const HEADER_ROMAN: CSSProperties = {
	fontSize: 14,
	letterSpacing: "0.4em",
	opacity: 0.4,
	marginBottom: 24,
}

export const HEADER_TITLE: CSSProperties = {
	fontSize: 32,
	letterSpacing: "0.15em",
	fontWeight: 400,
	marginBottom: 28,
}

export const HEADER_RULE_ROW: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: 12,
	opacity: 0.4,
}

export const HEADER_RULE_LINE: CSSProperties = {
	display: "inline-block",
	width: 40,
	height: 1,
	background: "currentColor",
}

export const HEADER_RULE_TRIGRAM: CSSProperties = {
	fontSize: 18,
}
