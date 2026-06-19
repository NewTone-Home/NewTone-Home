import type { CSSProperties } from "react"

const WISP_LIFTS_PX = [-3, 2]
const WISP_WIDTHS_PX = [10, 7]
const ASH_LIFTS_PX = [-6, -2, -8, 1]
const ASH_DRIFTS_PX = [9, 13, 11, 7]
const ASH_SIZES_PX = [3.5, 2.8, 3.2, 2.6]

export function smokeColumnStyle(): CSSProperties {
	return {
		position: "absolute",
		left: 22,
		top: -8,
		width: 24,
		height: 18,
		pointerEvents: "none",
	}
}

export function smokeWispStyle(index: number): CSSProperties {
	return {
		"--wisp-delay": index * 520 + "ms",
		"--wisp-width": WISP_WIDTHS_PX[index] + "px",
		"--wisp-lift": WISP_LIFTS_PX[index] + "px",
	} as CSSProperties
}

export function smokeAshStyle(index: number): CSSProperties {
	return {
		"--ash-delay": 160 + index * 430 + "ms",
		"--ash-drift": ASH_DRIFTS_PX[index] + "px",
		"--ash-lift": ASH_LIFTS_PX[index] + "px",
		"--ash-size": ASH_SIZES_PX[index] + "px",
	} as CSSProperties
}
