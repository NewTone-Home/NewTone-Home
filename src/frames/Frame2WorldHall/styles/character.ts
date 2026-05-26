import type { CSSProperties } from "react"

export const ENTRIES_WRAP_STYLE: CSSProperties = {
	flex: 1,
	width: "100%",
	display: "flex",
	flexDirection: "row",
	justifyContent: "space-around",
	alignItems: "center",
	paddingBottom: 120,
}

// 触发区比字符大,鼠标"接近"就响应,不需要精准 hover 到字符
export const ENTRY_TRIGGER_STYLE: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 18,
	padding: "60px 80px",
	background: "none",
	border: "none",
	cursor: "pointer",
	color: "inherit",
	fontFamily: "inherit",
}

export const SEAL_CHAR_STYLE: CSSProperties = {
	fontSize: 96,
	fontWeight: 400,
	lineHeight: 1,
	margin: 0,
	fontFamily:
		"'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', serif",
}
