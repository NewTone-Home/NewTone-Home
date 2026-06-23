import type { CSSProperties } from "react"

export const CONTAINER_STYLE: CSSProperties = {
	position: "fixed",
	inset: 0,
	zIndex: 0,
	overflow: "auto",
	background: "var(--color-bg)",
	color: "var(--color-text)",
	fontFamily: "inherit",
}

export const WRAP_STYLE: CSSProperties = {
	minHeight: "100%",
	width: "min(960px, calc(100vw - 40px))",
	margin: "0 auto",
	padding: "clamp(56px, 10vh, 96px) 0 clamp(80px, 14vh, 120px)",
	display: "flex",
	flexDirection: "column",
	justifyContent: "center",
	gap: "clamp(32px, 7vh, 72px)",
}

export const META_STYLE: CSSProperties = {
	margin: "0 0 10px",
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 0,
	opacity: 0.42,
}

export const TITLE_STYLE: CSSProperties = {
	margin: 0,
	fontSize: "clamp(30px, 6vw, 56px)",
	fontWeight: 300,
	letterSpacing: 0,
	lineHeight: 1.05,
}

export const SUBTITLE_STYLE: CSSProperties = {
	margin: "12px 0 0",
	fontSize: "clamp(13px, 2vw, 15px)",
	fontWeight: 300,
	letterSpacing: 0,
	opacity: 0.48,
}

export const CARD_GRID_STYLE: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
	gap: 12,
	width: "100%",
}

const BASE_CARD_STYLE: CSSProperties = {
	minHeight: 148,
	borderRadius: 6,
	padding: "18px 18px 16px",
	display: "flex",
	flexDirection: "column",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: 12,
	background: "color-mix(in srgb, var(--color-bg) 86%, transparent)",
	color: "inherit",
	fontFamily: "inherit",
	textAlign: "left",
}

export const AVAILABLE_CARD_STYLE: CSSProperties = {
	...BASE_CARD_STYLE,
	border: "1px solid color-mix(in srgb, var(--char-color-qian) 44%, transparent)",
	boxShadow: "0 0 28px color-mix(in srgb, var(--char-smoke-soft) 34%, transparent)",
	cursor: "pointer",
}

export const LOCKED_CARD_STYLE: CSSProperties = {
	...BASE_CARD_STYLE,
	border: "1px solid color-mix(in srgb, var(--color-text) 13%, transparent)",
	opacity: 0.38,
}

export const WORLD_ID_STYLE: CSSProperties = {
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 0,
	opacity: 0.56,
}

export const WORLD_NAME_STYLE: CSSProperties = {
	fontSize: 21,
	fontWeight: 300,
	letterSpacing: 0,
	lineHeight: 1.2,
}

export const WORLD_TAGLINE_STYLE: CSSProperties = {
	minHeight: 17,
	fontSize: 12,
	fontWeight: 300,
	letterSpacing: 0,
	lineHeight: 1.4,
	opacity: 0.52,
}

export const STATUS_STYLE: CSSProperties = {
	marginTop: "auto",
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 0,
	textTransform: "uppercase",
	opacity: 0.62,
}
