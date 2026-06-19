import type { CSSProperties } from "react"
import { PUFF_SWAYS_PX } from "../constants"

export function puffStyle(index: number): CSSProperties {
	const size = 18 + index * 3
	const stretch = 1.35 + (index % 3) * 0.18
	const rotate = -18 + index * 9
	const opacity = 0.34 + (index % 2) * 0.12
	return {
		"--puff-sway": PUFF_SWAYS_PX[index] + "px",
		"--puff-size": size + "px",
		"--puff-stretch": String(stretch),
		"--puff-rotate": rotate + "deg",
		"--puff-opacity": String(opacity),
	} as CSSProperties
}

export function puffsContainerStyle(q: number): CSSProperties {
	return {
		position: "absolute",
		inset: 0,
		opacity: q,
		transition: "opacity 800ms ease-out",
		pointerEvents: "none",
	}
}
