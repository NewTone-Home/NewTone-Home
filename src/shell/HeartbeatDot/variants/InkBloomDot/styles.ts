import type { CSSProperties } from "react"
import { DOT_SIZE_PX } from "../../shared/breathConfig"

const HALO_OFFSET = 9
const HALO_SIZE = DOT_SIZE_PX + HALO_OFFSET * 2

// 初墨世界画风:墨晕渲染（占位 radial-gradient,后期换真实笔触 SVG/Lottie）
export const INK_BLOOM_WRAPPER_STYLE: CSSProperties = {
	position: "relative",
	width: DOT_SIZE_PX,
	height: DOT_SIZE_PX,
}

export const INK_BLOOM_CORE_STYLE: CSSProperties = {
	position: "absolute",
	inset: 0,
	width: DOT_SIZE_PX,
	height: DOT_SIZE_PX,
	borderRadius: "50%",
	background: "#1a1a1a",
}

export const INK_BLOOM_HALO_STYLE: CSSProperties = {
	position: "absolute",
	left: -HALO_OFFSET,
	top: -HALO_OFFSET,
	width: HALO_SIZE,
	height: HALO_SIZE,
	borderRadius: "50%",
	background:
		"radial-gradient(circle, rgba(40,40,40,0.95) 0%, rgba(100,100,100,0.55) 35%, rgba(0,0,0,0) 72%)",
	filter: "blur(1.5px)",
}
