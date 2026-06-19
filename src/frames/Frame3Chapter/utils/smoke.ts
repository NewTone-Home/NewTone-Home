import type { CSSProperties } from "react"

export function smokeColumnStyle(q: number): CSSProperties {
	return {
		position: "absolute",
		left: "50%",
		bottom: -8,
		width: 72,
		height: 112,
		opacity: q * 0.86,
		overflow: "visible",
		pointerEvents: "none",
		transform: "translateX(-50%)",
		transition: "opacity 900ms ease-out",
	}
}

export function smokeWispStyle(index: number): CSSProperties {
	return {
		"--smoke-delay": index * 420 + "ms",
		"--smoke-duration": 3200 + index * 360 + "ms",
		"--smoke-sway": [-8, 6, -3][index] + "px",
	} as CSSProperties
}
