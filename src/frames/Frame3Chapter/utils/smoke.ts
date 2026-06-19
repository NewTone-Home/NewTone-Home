import type { CSSProperties } from "react"

const SMOKE_SWAYS_PX = [-10, 8, -5, 4]
const SMOKE_STROKE_WIDTHS = [1.9, 1.55, 1.25, 1]

export function smokeColumnStyle(q: number): CSSProperties {
	return {
		position: "absolute",
		left: "50%",
		bottom: -18,
		width: 88,
		height: 148,
		opacity: Math.min(0.72, q * 0.78),
		overflow: "visible",
		pointerEvents: "none",
		transform: "translateX(-50%)",
		transition: "opacity 1100ms ease-out",
	}
}

export function smokeWispStyle(index: number): CSSProperties {
	return {
		"--smoke-delay": index * 520 + "ms",
		"--smoke-duration": 4200 + index * 420 + "ms",
		"--smoke-sway": SMOKE_SWAYS_PX[index] + "px",
		"--smoke-width": SMOKE_STROKE_WIDTHS[index],
	} as CSSProperties
}
