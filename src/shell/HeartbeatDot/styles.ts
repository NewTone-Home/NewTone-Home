import type { CSSProperties } from "react"

const SOFT_TEXT = "rgba(226, 235, 237, 0.68)"

export const ROOT_STYLE: CSSProperties = {
	position: "fixed",
	right: "max(14px, env(safe-area-inset-right))",
	bottom: "max(14px, env(safe-area-inset-bottom))",
	width: 42,
	height: 42,
	zIndex: 110,
	pointerEvents: "none",
}

export const DOT_BUTTON_STYLE: CSSProperties = {
	position: "absolute",
	right: 0,
	bottom: 0,
	width: 38,
	height: 38,
	border: "1px solid rgba(211, 231, 235, 0.14)",
	borderRadius: 999,
	background: "rgba(5, 9, 13, 0.56)",
	backdropFilter: "blur(10px)",
	cursor: "pointer",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	padding: 0,
	pointerEvents: "auto",
	transition: "background 180ms ease, border-color 180ms ease, opacity 180ms ease",
}

export const DOT_BUTTON_ACTIVE_STYLE: CSSProperties = {
	background: "rgba(14, 22, 28, 0.78)",
	borderColor: "rgba(211, 231, 235, 0.26)",
}

export const DOT_BUTTON_DISABLED_STYLE: CSSProperties = {
	pointerEvents: "none",
	opacity: 0.42,
}

export const SIGNAL_DOT_STYLE: CSSProperties = {
	width: 9,
	height: 9,
	borderRadius: 999,
	background: "rgba(211, 231, 235, 0.82)",
	boxShadow: "0 0 12px rgba(126, 191, 210, 0.3)",
}

export const PANEL_STYLE: CSSProperties = {
	position: "absolute",
	right: 0,
	bottom: 46,
	width: "min(238px, calc(100vw - 28px))",
	padding: "12px",
	border: "1px solid rgba(211, 231, 235, 0.14)",
	borderRadius: 8,
	background: "rgba(7, 11, 16, 0.86)",
	boxShadow: "0 18px 48px rgba(0, 0, 0, 0.32)",
	backdropFilter: "blur(16px)",
	pointerEvents: "auto",
	color: "#eef8f8",
}

export const PANEL_TITLE_STYLE: CSSProperties = {
	margin: "0 0 10px",
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 0,
	color: "rgba(226, 235, 237, 0.56)",
}

export const ACTION_ROW_STYLE: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "52px 1fr",
	alignItems: "center",
	gap: 8,
	padding: "7px 0",
	borderTop: "1px solid rgba(211, 231, 235, 0.07)",
}

export const ACTION_LABEL_STYLE: CSSProperties = {
	minWidth: 0,
	fontSize: 11,
	fontWeight: 300,
	letterSpacing: 0,
	color: "rgba(226, 235, 237, 0.52)",
}

export const ACTION_VALUE_STYLE: CSSProperties = {
	display: "flex",
	justifyContent: "flex-end",
	gap: 3,
}

export const ACTION_BUTTON_STYLE: CSSProperties = {
	minWidth: 42,
	border: "1px solid rgba(211, 231, 235, 0.09)",
	borderRadius: 999,
	background: "transparent",
	color: SOFT_TEXT,
	fontFamily: "inherit",
	fontSize: 10,
	fontWeight: 300,
	letterSpacing: 0,
	padding: "5px 7px",
	cursor: "pointer",
	textAlign: "center",
}

export const ACTION_BUTTON_ACTIVE_STYLE: CSSProperties = {
	background: "rgba(151, 202, 220, 0.16)",
	color: "#f2fbfb",
}
