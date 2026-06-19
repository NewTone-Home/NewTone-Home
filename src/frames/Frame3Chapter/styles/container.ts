import type { CSSProperties } from "react"

export const CONTAINER: CSSProperties = {
	position: "fixed",
	inset: 0,
	overflowY: "auto",
	background:
		"linear-gradient(90deg, var(--color-paper-grain) 1px, transparent 1px), linear-gradient(0deg, var(--color-paper-grain) 1px, transparent 1px), var(--color-bg)",
	backgroundSize: "32px 32px, 32px 32px, auto",
	color: "var(--color-fg)",
}

export const SPACE: CSSProperties = {
	maxWidth: 580,
	margin: "0 auto",
	padding: "40vh 24px 25vh",
	fontFamily: '"Source Han Serif SC", "Noto Serif SC", "Songti SC", serif',
	lineHeight: 1.85,
}
