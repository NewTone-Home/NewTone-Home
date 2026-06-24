import type { CSSProperties } from "react"

const STATION_BG_URL = "/assets/multiverse/station-hub-bg.png"

export const CONTAINER_STYLE: CSSProperties = {
	position: "fixed",
	inset: 0,
	zIndex: 0,
	overflow: "auto",
	background: "var(--color-bg)",
	color: "var(--color-text)",
	fontFamily: "inherit",
}

export const BACKGROUND_STYLE: CSSProperties = {
	position: "fixed",
	inset: 0,
	backgroundImage: `url(${STATION_BG_URL})`,
	backgroundPosition: "center center",
	backgroundSize: "cover",
	backgroundRepeat: "no-repeat",
}

export const SCREEN_VEIL_STYLE: CSSProperties = {
	position: "fixed",
	inset: 0,
	background:
		"linear-gradient(90deg, color-mix(in srgb, var(--color-bg) 58%, transparent) 0%, color-mix(in srgb, var(--color-bg) 13%, transparent) 31%, transparent 56%), linear-gradient(180deg, color-mix(in srgb, #000 10%, transparent) 0%, transparent 42%, color-mix(in srgb, #000 18%, transparent) 100%)",
	pointerEvents: "none",
}

export const SCENE_OVERLAY_STYLE: CSSProperties = {
	position: "relative",
	minHeight: "100%",
	width: "min(1280px, 100vw)",
	margin: "0 auto",
}

export const ARRIVAL_GUIDE_STYLE: CSSProperties = {
	position: "absolute",
	left: "clamp(24px, 4.8vw, 72px)",
	top: "clamp(182px, 32vh, 278px)",
	width: "min(292px, calc(100vw - 48px))",
	paddingLeft: 13,
	borderLeft: "1px solid color-mix(in srgb, var(--color-text) 22%, transparent)",
}

export const ARRIVAL_KICKER_STYLE: CSSProperties = {
	margin: "0 0 14px",
	fontSize: 10,
	fontWeight: 300,
	letterSpacing: 0,
	textTransform: "uppercase",
	opacity: 0.48,
}

export const ARRIVAL_TITLE_STYLE: CSSProperties = {
	margin: "0 0 16px",
	fontSize: "clamp(19px, 2.4vw, 27px)",
	fontWeight: 300,
	letterSpacing: 0,
	lineHeight: 1.18,
}

export const ARRIVAL_BODY_STYLE: CSSProperties = {
	margin: "0 0 7px",
	fontSize: "clamp(11px, 1.25vw, 13px)",
	fontWeight: 300,
	letterSpacing: 0,
	lineHeight: 1.8,
	opacity: 0.46,
}

export const PLATFORM_WRAP_STYLE: CSSProperties = {
	position: "absolute",
	left: "48.2%",
	top: "9.8%",
	width: "min(34.5vw, 446px)",
	minWidth: 310,
	height: "min(17.4vw, 164px)",
	minHeight: 128,
}

export const PLATFORM_SIGN_STYLE: CSSProperties = {
	position: "relative",
	width: "100%",
	height: "100%",
	padding: "clamp(13px, 1.5vw, 19px) clamp(16px, 1.9vw, 24px)",
	display: "grid",
	gridTemplateColumns: "minmax(0, 1fr) auto",
	gridTemplateRows: "auto auto auto auto",
	columnGap: 18,
	rowGap: 3,
	border: 0,
	borderRadius: 0,
	background: "transparent",
	color: "color-mix(in srgb, #edf4f1 82%, transparent)",
	fontFamily: "inherit",
	textAlign: "left",
	cursor: "pointer",
}

export const SIGN_LABEL_STYLE: CSSProperties = {
	gridColumn: "1 / 2",
	fontSize: "clamp(10px, 1vw, 12px)",
	fontWeight: 300,
	letterSpacing: 0,
	textTransform: "uppercase",
	opacity: 0.52,
}

export const PLATFORM_NAME_STYLE: CSSProperties = {
	gridColumn: "1 / 2",
	fontSize: "clamp(32px, 4.2vw, 54px)",
	fontWeight: 300,
	letterSpacing: 0,
	lineHeight: 1.05,
}

export const CHUMO_CODE_STYLE: CSSProperties = {
	gridColumn: "2 / 3",
	gridRow: "1 / 3",
	alignSelf: "center",
	fontSize: "clamp(10px, 1vw, 12px)",
	fontWeight: 300,
	letterSpacing: 0,
	writingMode: "vertical-rl",
	opacity: 0.42,
}

export const BOARD_META_STYLE: CSSProperties = {
	gridColumn: "1 / 2",
	marginTop: 5,
	fontSize: "clamp(10px, 1vw, 12px)",
	fontWeight: 300,
	letterSpacing: 0,
	color: "color-mix(in srgb, var(--char-color-qian) 74%, #edf4f1 26%)",
	opacity: 0.78,
}

export const BOARD_ACTION_STYLE: CSSProperties = {
	gridColumn: "1 / 3",
	marginTop: 2,
	fontSize: "clamp(11px, 1.05vw, 13px)",
	fontWeight: 300,
	letterSpacing: 0,
	opacity: 0.58,
}

export const PLATFORM_STATUS_STYLE: CSSProperties = {
	position: "absolute",
	right: "4%",
	top: "10%",
	width: 5,
	height: 5,
	borderRadius: 999,
	background: "var(--char-color-qian)",
	boxShadow: "0 0 8px var(--char-color-qian)",
	opacity: 0.58,
}

export const INACTIVE_LINES_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	pointerEvents: "none",
}

export const INACTIVE_LINE_STYLE: CSSProperties = {
	position: "absolute",
	display: "grid",
	gridTemplateColumns: "24px minmax(0, 1fr)",
	alignItems: "center",
	gap: 5,
	width: 118,
	padding: 0,
	border: 0,
	borderRadius: 0,
	background: "transparent",
	color: "color-mix(in srgb, #edf4f1 72%, transparent)",
}

export const INACTIVE_LINE_DEPTH_STYLE: Record<"far" | "mid" | "near", CSSProperties> = {
	far: {
		right: "2.8%",
		top: "42.3%",
		transform: "scale(0.58)",
		opacity: 0.28,
	},
	mid: {
		right: "9.2%",
		top: "48.1%",
		transform: "scale(0.66)",
		opacity: 0.34,
	},
	near: {
		right: "17.3%",
		top: "54.2%",
		transform: "scale(0.74)",
		opacity: 0.42,
	},
}

export const INACTIVE_LINE_NUMBER_STYLE: CSSProperties = {
	fontSize: 12,
	fontWeight: 300,
	letterSpacing: 0,
	opacity: 0.58,
}

export const INACTIVE_LINE_LABEL_STYLE: CSSProperties = {
	minWidth: 0,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	fontSize: 10,
	fontWeight: 300,
	letterSpacing: 0,
	opacity: 0.42,
}
