import type { CSSProperties } from "react"
import { DOT_SIZE_PX } from "../../shared/breathConfig"

const HALO_OFFSET = 9
const HALO_SIZE = DOT_SIZE_PX + HALO_OFFSET * 2

// 多元宇宙画风:深空点（占位 hsl 蓝白,后期换真实星点 SVG/粒子）
export const DEEP_SPACE_WRAPPER_STYLE: CSSProperties = {
	position: "relative",
	width: DOT_SIZE_PX,
	height: DOT_SIZE_PX,
}

export const DEEP_SPACE_CORE_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	width: DOT_SIZE_PX,
	height: DOT_SIZE_PX,
	borderRadius: "50%",
	background: "hsl(220, 80%, 92%)",
	boxShadow: "0 0 4px hsl(220, 80%, 85%)",
}

export const DEEP_SPACE_HALO_STYLE: CSSProperties = {
	position: "absolute",
	left: -HALO_OFFSET,
	top: -HALO_OFFSET,
	width: HALO_SIZE,
	height: HALO_SIZE,
	borderRadius: "50%",
	background:
		"radial-gradient(circle, hsla(220, 80%, 80%, 0.85) 0%, hsla(220, 70%, 60%, 0.45) 35%, hsla(220, 60%, 40%, 0) 72%)",
	filter: "blur(1.5px)",
}
